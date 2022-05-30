export interface StatusDoc {
    type: "LISTENING" | "STREAMING" | "WATCHING" | "PLAYING" | "COMPETING";
    status: string;
}

export enum StatusType {
    LISTENING = "LISTENING",
    STREAMING = "STREAMING",
    WATCHING = "WATCHING",
    PLAYING = "PLAYING",
    COMPETING = "COMPETING"
}
