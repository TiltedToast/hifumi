import { ActivityType, ButtonInteraction, Embed, EmbedBuilder, Message } from "discord.js";
import type { Document, WithId } from "mongodb";
import { z } from "zod";

export const MikuEmoteReactionItemsSchema = z.tuple([
    z.record(z.string(), z.array(z.string())),
    z.record(z.string(), z.array(z.string())),
]);

export type MikuEmoteReactionItems = z.infer<typeof MikuEmoteReactionItemsSchema>;

export type UpdateEmbedArrParams<T> = {
    result: T[];
    userID: string;
    sortKey?: keyof T & string;
    embedArray: EmbedMetadata[];
    buildEmbedFunc: (item: T, idx: number, arr: T[]) => EmbedBuilder;
};

const UrbanEntrySchema = z.object({
    definition: z.string(),
    permalink: z.string().url(),
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

export type UpdateEmbedOptions = {
    interaction: ButtonInteraction;
    embedArray: EmbedMetadata[];
    prevButtonId: string;
    nextButtonId: string;
    user: string;
};

export type EmbedMetadata = {
    embed: Embed | EmbedBuilder;
    user: string;
};

export const ConvertResponseSchema = z.object({
    result: z.union([z.literal("success"), z.literal("error")]),
    "error-type": z.string().optional(),
    conversion_rates: z.record(z.number()),
});

export type ConvertResponse = z.infer<typeof ConvertResponseSchema>;

export type ErrorLogOptions = {
    message?: Message;
    errorObject: Error;
};

export enum FileSizeLimit {
    DiscordFile = 8388608,
    DiscordEmoji = 262144,
    ImgurFile = 10485760,
}

const ImgurErrorSchema = z.object({
    code: z.number(),
    message: z.string(),
    type: z.string(),
    method: z.string(),
    request: z.string(),
});

export const ImgurResponseSchema = z.object({
    data: z.object({
        link: z.string().url(),
        error: ImgurErrorSchema.optional(),
    }),
    success: z.boolean(),
    status: z.number(),
});

export type ImgurResponse = z.infer<typeof ImgurResponseSchema>;

export type ImgurParams = {
    message: Message;
    prefix: string;
    url?: string;
};

export type MessageCommandData = {
    command: string;
    subCmd: string;
    message: Message;
    prefix: string;
};

export type ResizeOptions = {
    fileLocation: string;
    width: number;
    saveLocation: string;
};

export type StatusDoc = {
    type: keyof typeof StatusType;
    status: string;
} & WithId<Document>;

export const StatusType = {
    LISTENING: ActivityType.Listening,
    STREAMING: ActivityType.Streaming,
    WATCHING: ActivityType.Watching,
    PLAYING: ActivityType.Playing,
    COMPETING: ActivityType.Competing,
} as const;
