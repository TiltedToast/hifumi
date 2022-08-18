import type { Interaction, ButtonInteraction } from "discord.js";
import { updateEmbed } from "../tools.js";
import { urbanEmbeds } from "../commands/miscellaneous.js";

export default async function handleInteraction(interaction: Interaction) {
    if (interaction.isButton()) await handleButtonInteraction(interaction);
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