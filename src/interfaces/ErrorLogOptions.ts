import type { Message } from "discord.js";

export interface ErrorLogOptions {
    message: Message | null;
    errorObject: Error;
}
