import type { APIEmbed } from "discord-api-types";
import type { ButtonInteraction, MessageEmbed } from "discord.js";

export interface UpdateEmbedOptions {
    interaction: ButtonInteraction;
    embedArray: EmbedMetadata[];
    prevButtonId: string;
    nextButtonId: string;
    user: string;
}

export interface EmbedMetadata  {
    embed: MessageEmbed | APIEmbed;
    user: string;
}
