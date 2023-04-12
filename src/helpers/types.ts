import { ActivityType, ButtonInteraction, Embed, EmbedBuilder, Message } from "discord.js";
import { z } from "zod";

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

export const SupportedCodesSchema = z.object({
    result: z.union([z.literal("success"), z.literal("error")]),
    "error-type": z
        .union([
            z.literal("invalid-key"),
            z.literal("inactive-account"),
            z.literal("quota-reached"),
        ])
        .optional(),
    supported_codes: z.array(z.tuple([z.string(), z.string()])),
});

export type SupportedCodesResponse = z.infer<typeof SupportedCodesSchema>;

export const PairConversionResponseSchema = z.object({
    result: z.union([z.literal("success"), z.literal("error")]),
    base_code: z.string().optional(),
    target_code: z.string().optional(),
    conversion_rate: z.number().optional(),
    conversion_result: z.number().optional(),
    time_last_update_unix: z.number().optional(),
    time_last_update_utc: z.string().optional(),
    "error-type": z.union([
        z.literal("unsupported-code"),
        z.literal("malformed-request"),
        z.literal("invalid-key"),
        z.literal("inactive-account"),
        z.literal("quota-reached").optional(),
    ]),
});

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

export const StatusType = {
    LISTENING: ActivityType.Listening,
    STREAMING: ActivityType.Streaming,
    WATCHING: ActivityType.Watching,
    PLAYING: ActivityType.Playing,
    COMPETING: ActivityType.Competing,
} as const;
