import type { ButtonInteraction, Interaction } from "discord.js";
import { urbanEmbeds } from "../commands/miscellaneous.js";
import { updateEmbed } from "../helpers/utils.js";

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
