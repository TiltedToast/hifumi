import type { Message } from "discord.js";

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
