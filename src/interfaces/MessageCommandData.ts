import type { Message } from "discord.js";

export default interface MessageCommandData {
    command: string;
    subCmd: string;
    message: Message;
    prefix: string;
}
