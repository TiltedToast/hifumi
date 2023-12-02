import { type Message } from "discord.js";
import { botIsLoading, prefixMap } from "../app.js";
import * as db from "../commands/database.js";
import * as emoji from "../commands/emoji.js";
import * as imgProcess from "../commands/imgProcess.js";
import * as misc from "../commands/miscellaneous.js";
import * as reddit from "../commands/reddit.js";
import { db as DBConn } from "../db/index.js";

import { DEFAULT_PREFIX, DEV_PREFIX, RELOAD_PREFIX } from "../config.js";
import { prefixes } from "../db/schema.js";
import type { MessageCommandData } from "../helpers/types.js";
import { clientNoPermissions, errorLog, isDev, isMikuTrigger } from "../helpers/utils.js";

export default async function handleMessage(message: Message) {
    const guildClient = await message.guild?.members.fetchMe();
    try {
        // Permission check for the channel which the message was sent in to avoid breaking the bot
        if (message.author.bot || clientNoPermissions(message, guildClient) || botIsLoading) return;

        const content = message.content.split(" ");

        // React-Command check for reacting to Miku's emote commands
        const reactCmd = content[0].slice(1);
        const subCmd = content[1];

        // Adds a default prefix to the db if it doesn't exist
        if (message.guild && !prefixMap.has(message.guild.id) && !isDev()) {
            await DBConn.insert(prefixes).values({
                serverId: message.guild.id,
                prefix: DEFAULT_PREFIX,
            });
            prefixMap.set(message.guild.id, DEFAULT_PREFIX);
        }

        // Gets the prefix from the map and compares to the message's beginning
        // This way the prefix can be case insensitive
        const prefix = isDev()
            ? DEV_PREFIX
            : prefixMap.get(message.guild?.id ?? "") ?? DEFAULT_PREFIX;

        const command = content[0].slice(prefix.length).toLowerCase();
        const lowerCasePrefix = content[0].substring(0, prefix.length).toLowerCase();

        if (message.content.toLowerCase().startsWith(`${RELOAD_PREFIX}~~~`) && !isDev())
            await misc.reloadBot(message);
        if (message.content.toLowerCase().startsWith(`${RELOAD_PREFIX}~`) && isDev())
            await misc.reloadBot(message);

        if (lowerCasePrefix === prefix.toLowerCase()) {
            await handleCommand({ command, subCmd, message });
        }

        // Reacting to Miku's emote commands
        // Grabs a random reply from the db and sends it as a message after a fixed delay
        if (isMikuTrigger(message, reactCmd)) {
            await misc.reactToMiku(message, reactCmd);
        }
        await misc.checkForImgAndCreateThread(message);
    } catch (err: unknown) {
        await errorLog({ message, errorObject: err as Error });
    }
}

async function handleCommand({ command, subCmd, message }: MessageCommandData) {
    if (command === "emoji") {
        if (["add", "ad", "create"].includes(subCmd)) {
            return await emoji.addEmoji(message);
        } else if (["delete", "delet", "del", "remove", "rm"].includes(subCmd)) {
            return await emoji.removeEmoji(message);
        } else if (["edit", "e", "rename", "rn"].includes(subCmd)) {
            return await emoji.renameEmoji(message);
        } else if (subCmd === "link") {
            return await emoji.linkEmoji(message);
        } else if (["search", "s"].includes(subCmd)) {
            return await emoji.searchEmojis(message);
        }
    } else if (["status", "stat"].includes(command)) {
        return await db.insertStatus(message);
    } else if (["commands", "command", "comm", "com", "help"].includes(command)) {
        return await misc.helpCmd(message);
    } else if (["avatar", "pfp"].includes(command)) {
        return await misc.avatar(message);
    } else if (command === "bye") {
        return await misc.bye(message);
    } else if (command === "beautiful") {
        return await imgProcess.beautiful(message);
    } else if (command === "resize") {
        return await imgProcess.resizeImg(message);
    } else if (command === "imgur") {
        return await imgProcess.imgur(message);
    } else if (command === "profile") {
        return await reddit.profile(message);
    } else if (command === "prefix") {
        return await db.updatePrefix(message);
    } else if (command === "con") {
        return await misc.cmdConsole(message);
    } else if (command === "qr") {
        return await imgProcess.qrCode(message);
    } else if (command === "js") {
        return await misc.jsEval(message);
    } else if (command === "link") {
        return await emoji.linkEmoji(message);
    } else if (command === "leet") {
        return await misc.leet(message);
    } else if (command === "pull") {
        return await misc.gitPull(message);
    } else if (command === "someone") {
        return await misc.pingRandomMembers(message);
    } else if (command === "yoink") {
        return await emoji.addEmoji(message);
    } else if (command === "db") {
        return await db.runSQL(message);
    } else if (["wolfram", "wolf"].includes(command)) {
        return await misc.wolframAlpha(message, command);
    } else if (["calc", "math"].includes(command)) {
        return await misc.calc(message);
    } else if (command === "py") {
        return await misc.py(message);
    } else if (["cur", "convert"].includes(command)) {
        return await misc.convert(message);
    } else if (command === "urban") {
        return await misc.urban(message);
    } else if (command === "sub") {
        return await reddit.sub(message);
    }
}
