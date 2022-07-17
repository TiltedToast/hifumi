import { ActivityType } from "discord.js";

export interface StatusDoc {
    type: "LISTENING" | "WATCHING" | "PLAYING" | "STREAMING" | "COMPETING";
    status: string;
}

export const StatusType = {
    "LISTENING" : ActivityType.Listening as ActivityType.Listening,
    "STREAMING" : ActivityType.Streaming as ActivityType.Streaming,
    "WATCHING" : ActivityType.Watching as ActivityType.Watching,
    "PLAYING" : ActivityType.Playing as ActivityType.Playing,
    "COMPETING" : ActivityType.Competing as ActivityType.Competing,
}

