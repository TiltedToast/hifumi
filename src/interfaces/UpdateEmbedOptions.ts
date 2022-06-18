import type { APIEmbed } from "discord-api-types";
import type { ButtonInteraction, MessageEmbed, User } from "discord.js";

export interface UpdateEmbedOptions {
    interaction: ButtonInteraction;
    embedArray: EmbedMetadata[];
    prevButtonId: string;
    nextButtonId: string;
    user: User;
}

export interface EmbedMetadata  {
    embed: MessageEmbed | APIEmbed;
    user: User;
}
