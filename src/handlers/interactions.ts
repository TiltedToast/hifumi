import type { ButtonInteraction, ChatInputCommandInteraction, Interaction } from "discord.js";
import { helpCmd, urbanEmbeds } from "../commands/miscellaneous.js";
import { updateEmbed } from "../helpers/utils.js";
import { sub } from "../commands/reddit.js";

export default async function handleInteraction(interaction: Interaction) {
    try {
        if (interaction.isButton()) await handleButtonInteraction(interaction);
        if (interaction.isChatInputCommand()) await handleCommandInteraction(interaction);
    } catch (error) {
        console.error(error);
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
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        await interaction.reply(`$pat ${interaction.options.getUser("user")}`);
    } else if (interaction.commandName === "help") {
        await helpCmd(interaction);
    } else if (interaction.commandName === "sub") {
        await sub(interaction);
    }
}
