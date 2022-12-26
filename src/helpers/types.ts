import { ActivityType, ButtonInteraction, Embed, EmbedBuilder, Message } from "discord.js";
import type { Document, WithId } from "mongodb";
import { z } from "zod";

export interface MikuEmoteAliases {
    [key: string]: string[];
}

export interface MikuEmoteReactionMessages {
    [key: string]: string[];
}

export type MikuEmoteReactionItems = [MikuEmoteAliases, MikuEmoteReactionMessages];
export interface UpdateEmbedArrParams<T> {
    result: T[];
    userID: string;
    sortKey?: keyof T & string;
    embedArray: EmbedMetadata[];
    buildEmbedFunc: (item: T, idx: number, arr: T[]) => EmbedBuilder;
}

const UrbanEntrySchema = z.object({
    definition: z.string(),
    permalink: z.string(),
    thumbs_up: z.number(),
    author: z.string(),
    word: z.string(),
    example: z.string(),
    thumbs_down: z.number(),
});

export const UrbanResponseSchema = z.object({
    list: z.array(UrbanEntrySchema),
});

export type UrbanResponse = z.infer<typeof UrbanResponseSchema>;

export type UrbanEntry = z.infer<typeof UrbanEntrySchema>;

export const CatFactResponseSchema = z.object({
    fact: z.string(),
    length: z.number(),
});

export type CatFactResponse = z.infer<typeof CatFactResponseSchema>;

export interface UpdateEmbedOptions {
    interaction: ButtonInteraction;
    embedArray: EmbedMetadata[];
    prevButtonId: string;
    nextButtonId: string;
    user: string;
}

export interface EmbedMetadata {
    embed: Embed | EmbedBuilder;
    user: string;
}

export const ConvertResponseSchema = z.object({
    result: z.union([z.literal("success"), z.literal("error")]),
    documentation: z.string().optional(),
    terms_of_use: z.string().optional(),
    time_zone: z.string().optional(),
    time_last_update: z.number().optional(),
    time_next_update: z.number().optional(),
    base: z.string().optional(),
    "error-type": z.string().optional(),
    conversion_rates: z.record(z.number()),
});

export type ConvertResponse = z.infer<typeof ConvertResponseSchema>;

export interface ErrorLogOptions {
    message: Message | null;
    errorObject: Error;
}

export enum FileSizeLimit {
    DiscordFile = 8388608,
    DiscordEmoji = 262144,
    ImgurFile = 10485760,
}

export interface ImgurResponse {
    data: ImgurData;
    success: boolean;
    status: number;
}

export interface ImgurData {
    id: string;
    title: null | string;
    error: null | ImgurError;
    description: null | string;
    datetime: number;
    type: string;
    animated: boolean;
    width: number;
    height: number;
    size: number;
    views: number;
    bandwidth: number;
    vote: null | string;
    favorite: boolean;
    nsfw: null | boolean;
    section: null | string;
    account_url: null | string;
    account_id: number;
    is_ad: boolean;
    in_most_viral: boolean;
    has_sound: boolean;
    tags: null | string[];
    ad_type: number;
    ad_url: string;
    edited: string;
    in_gallery: boolean;
    deletehash: string;
    name: string;
    link: string;
}

interface ImgurError {
    code: number;
    message: string;
    type: string;
    method: string;
    request: string;
}

export interface ImgurParams {
    message: Message;
    prefix: string;
    url?: string;
}

export interface MessageCommandData {
    command: string;
    subCmd: string;
    message: Message;
    prefix: string;
}

export interface ResizeOptions {
    fileLocation: string;
    width: number;
    saveLocation: string;
}

export interface StatusDoc extends WithId<Document> {
    type: "LISTENING" | "WATCHING" | "PLAYING" | "STREAMING" | "COMPETING";
    status: string;
}

export const StatusType = {
    LISTENING: ActivityType.Listening as ActivityType.Listening,
    STREAMING: ActivityType.Streaming as ActivityType.Streaming,
    WATCHING: ActivityType.Watching as ActivityType.Watching,
    PLAYING: ActivityType.Playing as ActivityType.Playing,
    COMPETING: ActivityType.Competing as ActivityType.Competing,
};
