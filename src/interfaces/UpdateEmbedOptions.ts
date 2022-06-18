import type { ButtonInteraction, MessageEmbed } from "discord.js";

export interface UpdateEmbedOptions {
    interaction: ButtonInteraction;
    embedArray: MessageEmbed[];
    prevButtonId: string;
    nextButtonId: string;
}
