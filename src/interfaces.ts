export type JSONValue = string | number | boolean | JSONObject | JSONArray;

export interface JSONObject {
    [x: string]: JSONValue;
}

export type JSONArray = Array<JSONValue>;

export interface ConvertResult {
    result: string;
    documentation: string;
    terms_of_use: string;
    time_zone: string;
    time_last_update: number;
    time_next_update: number;
    base: string;
    conversion_rates: {
        [x: string]: number;
    };
}

export interface UrbanResult {
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

export interface ImgurResult {
    data: ImgurData;
    success: boolean;
    status: number;
}

export interface ImgurData {
    id: string;
    title: null | string;
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

export interface StatusDoc {
    type: "LISTENING" | "STREAMING" | "WATCHING" | "PLAYING" | "COMPETING";
    status: string;
}
