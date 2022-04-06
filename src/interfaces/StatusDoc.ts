export interface StatusDoc {
    type: "LISTENING" | "STREAMING" | "WATCHING" | "PLAYING" | "COMPETING";
    status: string;
}
