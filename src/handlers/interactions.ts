import {
    ButtonInteraction,
    ChatInputCommandInteraction,
    Interaction,
    codeBlock,
    userMention,
} from "discord.js";
import { client } from "../app.js";
import { convert, helpCmd, patUser, urban, urbanEmbeds } from "../commands/miscellaneous.js";
import { sub } from "../commands/reddit.js";
import { BOT_OWNERS, DEV_CHANNELS, LOG_CHANNEL, OWNER_NAME } from "../config.js";
import { updateEmbed } from "../helpers/utils.js";

export default async function handleInteraction(interaction: Interaction) {
    try {
        if (interaction.isButton()) await handleButtonInteraction(interaction);
        if (interaction.isChatInputCommand()) await handleCommandInteraction(interaction);
    } catch (error) {
        console.error(error);

        const msg =
            "Congratulations, you broke me! Or maybe it was discord, who knows? " +
            `Either way, I'm broken now. ` +
            `Please try again later or contact my owner \`${OWNER_NAME}\` if it keeps happening.`;

        if (interaction.isChatInputCommand()) {
            if (interaction.deferred) {
                await interaction.editReply(msg);
            } else {
                await interaction.reply({ content: msg, ephemeral: true });
            }
        }

        const channel = DEV_CHANNELS.includes(interaction.channel?.id ?? "")
            ? interaction.channel
            : await client.channels.fetch(LOG_CHANNEL);

        if (!channel?.isTextBased()) return;

        if (!interaction.isChatInputCommand()) return;
        await channel.send(
            codeBlock("js", `${error as string}`) + `\n${userMention(BOT_OWNERS[0])}`
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

type ChatInputCommandFn = (interaction: ChatInputCommandInteraction) => Promise<unknown>;

const commands = new Map<string, ChatInputCommandFn>([
    ["pat", patUser],
    ["help", helpCmd],
    ["sub", sub],
    ["urban", urban],
    ["convert", convert],
]);

async function handleCommandInteraction(interaction: ChatInputCommandInteraction) {
    return await commands.get(interaction.commandName)?.(interaction);
}
