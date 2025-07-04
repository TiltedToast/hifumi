import type { Message } from "discord.js";
import * as db from "../commands/database.ts";
import * as emoji from "../commands/emoji.ts";
import * as imgProcess from "../commands/imgProcess.ts";
import * as misc from "../commands/miscellaneous.ts";
import * as reddit from "../commands/reddit.ts";
import { DEFAULT_PREFIX, DEV_PREFIX, RELOAD_PREFIX } from "../config.ts";
import { insertPrefix } from "../db/index.ts";
import type { MessageCommandData, NarrowedMessage } from "../helpers/types.ts";
import {
    clientHasPermissions,
    errorLog,
    isAiTrigger,
    isDev,
} from "../helpers/utils.ts";
import { isLoading, prefixMap } from "./prefixes.ts";

export default async function handleMessage(originalMessage: Message) {
    try {
        // Permission check for the channel which the message was sent in to avoid breaking the bot
        if (
            originalMessage.author.bot ||
            !(await clientHasPermissions(originalMessage)) ||
            isLoading() ||
            !originalMessage.channel.isSendable()
        ) {
            return;
        }

        /* This is fine, PartialGroupDMChannel is explicitly checked above so .send is always there */
        const message = originalMessage as NarrowedMessage;

        const content = message.content.split(" ").filter(Boolean);
        const len = content.length;

        // React-Command check for reacting to Ai's emote commands
        const reactCmd = len >= 1 ? content[0]!.slice(1) : "";
        const subCmd = len >= 2 ? content[1]! : "";

        // Adds a default prefix to the db if it doesn't exist
        if (message.guild && !prefixMap.has(message.guild.id) && !isDev()) {
            await insertPrefix(message.guild.id, DEFAULT_PREFIX);
            prefixMap.set(message.guild.id, DEFAULT_PREFIX);
        }

        const prefix = isDev()
            ? DEV_PREFIX
            : (prefixMap.get(message.guild?.id ?? "") ?? DEFAULT_PREFIX);

        const command =
            len >= 1 ? content[0]!.slice(prefix.length).toLowerCase() : "";
        const lowerCasePrefix =
            len >= 1
                ? content[0]!.substring(0, prefix.length).toLowerCase()
                : "";

        if (
            message.content.toLowerCase().startsWith(`${RELOAD_PREFIX}~~~`) &&
            !isDev()
        ) {
            await misc.reloadBot(message);
        }
        if (
            message.content.toLowerCase().startsWith(`${RELOAD_PREFIX}~`) &&
            isDev()
        ) {
            await misc.reloadBot(message);
        }

        if (lowerCasePrefix === prefix.toLowerCase()) {
            await handleCommand({
                command,
                subCmd,
                message,
                prefix,
            });
        }

        // Reacting to Ai's emote commands
        // Grabs a random reply from the db and sends it as a message after a fixed delay
        if (isAiTrigger(message, reactCmd)) {
            await misc.reactToAi(message, reactCmd);
        }
        await misc.checkForImgAndCreateThread(message);
    } catch (err: unknown) {
        await errorLog({
            message: originalMessage,
            errorObject: err as Error,
        });
    }
}

function handleCommand({
    command,
    subCmd,
    message,
    prefix,
}: MessageCommandData) {
    // biome-ignore format: this is neat
    switch (command) {
        case "bye":       return misc.bye(message);
        case "beautiful": return imgProcess.beautiful(message);
        case "resize":    return imgProcess.resizeImg(message, prefix);
        case "imgur":     return imgProcess.imgur(message, prefix);
        case "prefix":    return db.updatePrefix(message);
        case "con":       return misc.cmdConsole(message);
        case "qr":        return imgProcess.qrCode(message);
        case "js":        return misc.jsEval(message);
        case "link":      return emoji.linkEmoji(message);
        case "leet":      return misc.leet(message);
        case "pull":      return misc.gitPull(message);
        case "someone":   return misc.pingRandomMembers(message);
        case "yoink":     return emoji.addEmoji(message, prefix);
        case "db":        return db.runSQL(message);
        case "py":        return misc.py(message);
        case "urban":     return misc.urban(message);
        case "sub":       return reddit.sub(message);
        case "test":      return misc.test(message);

        case "emoji":     return handleEmojiCommand({ command, subCmd, message, prefix });

        case "wolf":
        case "wolfram":   return misc.wolframAlpha(message, command);

        case "cur":
        case "conv":
        case "convert":   return misc.convert(message);

        case "commands":
        case "command":
        case "comm":
        case "com":
        case "help":      return misc.helpCmd(message);

        case "status":
        case "stat":      return db.insertStatus(message);

        case "avatar":
        case "pfp":       return misc.avatar(message);

        case "calc":
        case "math":      return misc.calc(message);
    }
}

function handleEmojiCommand({ subCmd, message, prefix }: MessageCommandData) {
    // biome-ignore format: this is neat
    switch (subCmd) {
        case "add":
        case "ad":
        case "create":  return emoji.addEmoji(message, prefix);

        case "delete":
        case "delet":
        case "del":
        case "rm":
        case "remove": return emoji.removeEmoji(message);

        case "edit":
        case "e":
        case "rename":
        case "rn":     return emoji.renameEmoji(message, prefix);

        case "link":   return emoji.linkEmoji(message);

        case "search":
        case "s":      return emoji.searchEmojis(message);

        case "convert":
        case "conv":
        case "gifify": return emoji.pngToGifEmoji(message);
    }
}
