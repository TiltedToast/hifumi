import type { ButtonInteraction, CommandInteraction, Interaction } from "discord.js";
import { helpCmd, urbanEmbeds } from "../commands/miscellaneous.js";
import { updateEmbed } from "../helpers/utils.js";

export default async function handleInteraction(interaction: Interaction) {
    try {
        if (interaction.isButton()) await handleButtonInteraction(interaction);
        if (interaction.isCommand()) await handleCommandInteraction(interaction);
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

async function handleCommandInteraction(interaction: CommandInteraction) {
    if (interaction.commandName === "pat") {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        await interaction.reply(`$pat ${interaction.options.getUser("user")}`);
    } else if (interaction.commandName === "help") {
        await helpCmd(interaction);
    }
}
