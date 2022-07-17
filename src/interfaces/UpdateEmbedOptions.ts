import type { ButtonInteraction, Embed, EmbedBuilder } from "discord.js";

export interface UpdateEmbedOptions {
    interaction: ButtonInteraction;
    embedArray: EmbedMetadata[];
    prevButtonId: string;
    nextButtonId: string;
    user: string;
}

export interface EmbedMetadata  {
    embed: Embed | EmbedBuilder;
    user: string;
}
