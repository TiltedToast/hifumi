import {
    ButtonInteraction,
    ChatInputCommandInteraction,
    Interaction,
    codeBlock,
    userMention,
} from "discord.js";
import { helpCmd, urbanEmbeds } from "../commands/miscellaneous.js";
import { sub } from "../commands/reddit.js";
import { BOT_OWNERS, LOG_CHANNEL, OWNER_USERNAME } from "../config.js";
import { updateEmbed } from "../helpers/utils.js";

export default async function handleInteraction(interaction: Interaction) {
    try {
        if (interaction.isButton()) await handleButtonInteraction(interaction);
        if (interaction.isChatInputCommand()) await handleCommandInteraction(interaction);
    } catch (error) {
        console.error(error);

        if (interaction.isChatInputCommand() && interaction.isRepliable()) {
            await interaction.reply({
                content:
                    "Congratulations, you broke me! Or maybe it was discord, who knows? " +
                    `Either way, I'm broken now. ` +
                    `Please try again later or contact my owner ${OWNER_USERNAME} if it keeps happening.`,
                ephemeral: true,
            });
        }

        const channel = interaction.client.channels.cache.get(LOG_CHANNEL);
        if (!channel?.isTextBased()) return;

        if (!interaction.isChatInputCommand()) return;
        await channel.send(
            codeBlock("js", `${error as string}`) + `\n\n${userMention(BOT_OWNERS[0])}`
        );
    }
}

async function handleButtonInteraction(interaction: ButtonInteraction) {
    if (["prevUrban", "nextUrban"].includes(interaction.customId)) {
        await updateEmbed({
            interaction,
            embedArray: urbanEmbeds,
            prevButtonId: "prevUrban",
            nextButtonId: "nextUrban",
            user: interaction.user.id,
        });
    }
}

async function handleCommandInteraction(interaction: ChatInputCommandInteraction) {
    if (interaction.commandName === "pat") {
        await interaction.reply(`$pat ${interaction.options.getUser("user", true).toString()}`);
    } else if (interaction.commandName === "help") {
        await helpCmd(interaction);
    } else if (interaction.commandName === "sub") {
        await sub(interaction);
    }
}
