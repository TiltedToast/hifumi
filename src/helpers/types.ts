import { ActivityType, ButtonInteraction, Embed, EmbedBuilder, Message } from "discord.js";
import type { Document, WithId } from "mongodb";

export interface MikuEmoteAliases {
    [key: string]: string[];
}

export interface MikuEmoteReactionMessages {
    [key: string]: string[];
}

export interface UpdateEmbedArrParams<T> {
    result: T[];
    userID: string;
    sortKey?: keyof T & string;
    embedArray: EmbedMetadata[];
    buildEmbedFunc: (item: T, idx: number, arr: T[]) => EmbedBuilder;
}

export interface UrbanResponse {
    list: UrbanEntry[];
}

export interface UrbanEntry {
    definition: string;
    permalink: string;
    thumbs_up: number;
    sound_urls: string[];
    author: string;
    word: string;
    defid: number;
    current_vote: string;
    written_on: string;
    example: string;
    thumbs_down: number;
}

export interface CatFactResponse {
    fact: string;
    length: number;
}

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

export interface ConvertResponse {
    result: "success" | "error";
    documentation?: string;
    terms_of_use?: string;
    time_zone?: string;
    time_last_update?: number;
    time_next_update?: number;
    base?: string;
    "error-type"?: string;
    conversion_rates?: {
        [currency: string]: number;
    };
}

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
