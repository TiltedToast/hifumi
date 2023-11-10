import { ActivityType, ButtonInteraction, Embed, EmbedBuilder, Message, User } from "discord.js";
import { z } from "zod";

export type UpdateEmbedArrParams<T> = {
    result: T[];
    user: User;
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
    user: User;
};

export type EmbedMetadata = {
    embed: Embed | EmbedBuilder;
    user: User;
};

const SuccessfulSupportedCodesSchema = z.object({
    result: z.literal("success"),
    supported_codes: z.array(z.tuple([z.string(), z.string()])),
});

const FailedSupportedCodesSchema = z.object({
    result: z.literal("error"),
    "error-type": z.enum(["invalid-key", "inactive-account", "quota-reached"]),
});

export const SupportedCodesSchema = z.union([
    SuccessfulSupportedCodesSchema,
    FailedSupportedCodesSchema,
]);

export type SupportedCodesResponse = z.infer<typeof SupportedCodesSchema>;

const SuccessfulPairConversionSchema = z.object({
    result: z.literal("success"),
    time_last_update_utc: z.string(),
    conversion_rate: z.number(),
    conversion_result: z.number(),
});

const FailedPairConversionSchema = z.object({
    result: z.literal("error"),
    "error-type": z.enum([
        "unsupported-code",
        "malformed-request",
        "invalid-key",
        "inactive-account",
        "quota-reached",
    ]),
});

export const PairConversionResponseSchema = z.union([
    SuccessfulPairConversionSchema,
    FailedPairConversionSchema,
]);

export type PairConversionResponse = z.infer<typeof PairConversionResponseSchema>;

export type ErrorLogOptions = {
    message?: Message;
    errorObject: Error;
};

export const FileSizeLimit = {
    DiscordFile: 8388608,
    DiscordEmoji: 262144,
    ImgurFile: 10485760,
} as const;

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

export type MessageCommandData = {
    command: string;
    subCmd: string;
    message: Message;
};

export type ResizeOptions = {
    fileLocation: string;
    width: number;
    saveLocation: string;
};

export const StatusType = {
    LISTENING: ActivityType.Listening,
    STREAMING: ActivityType.Streaming,
    WATCHING: ActivityType.Watching,
    PLAYING: ActivityType.Playing,
    COMPETING: ActivityType.Competing,
    CUSTOM: ActivityType.Custom,
} as const;
