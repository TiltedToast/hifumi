import type { Message } from "discord.js";
import { botIsLoading, mongoClient, prefixes } from "../app.js";
import * as db from "../commands/database.js";
import * as emoji from "../commands/emoji.js";
import * as imgProcess from "../commands/imgProcess.js";
import * as misc from "../commands/miscellaneous.js";
import * as reddit from "../commands/reddit.js";

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

        const prefixColl = mongoClient.db("hifumi").collection("prefixes");

        // Adds a default prefix to the db if it doesn't exist
        if (message.guild && !prefixes.has(message.guild.id) && !isDev()) {
            await prefixColl.insertOne({
                serverId: message.guild.id,
                prefix: "h!",
            });
            prefixes.set(message.guild.id, "h!");
            await message.channel.send(
                "I have set the prefix to `h!`. You can change it with `h!prefix`"
            );
        }

        // Gets the prefix from the map and compares to the message's beginning
        // This way the prefix can be case insensitive
        let prefix = "h!";
        if (message.guild) prefix = prefixes.get(message.guild.id) ?? "h!";

        if (isDev()) prefix = "h?";

        const command = content[0].slice(prefix.length).toLowerCase();
        const lowerCasePrefix = content[0].substring(0, prefix.length).toLowerCase();

        if (message.content.toLowerCase() === "hr~~~" && !isDev()) await misc.reloadBot(message);
        if (message.content.toLowerCase() === "hr~" && isDev()) await misc.reloadBot(message);

        if (lowerCasePrefix === prefix.toLowerCase()) {
            await handleCommand({ command, subCmd, message, prefix });
        }

        // Reacting to Miku's emote commands
        // Grabs a random reply from the db and sends it as a message after a fixed delay
        if (isMikuTrigger(message, reactCmd)) {
            await misc.reactToMiku(message, reactCmd);
        }
        misc.checkForImgAndCreateThread(message);
    } catch (err: unknown) {
        await errorLog({ message, errorObject: err as Error });
    }
}

async function handleCommand({ command, subCmd, message, prefix }: MessageCommandData) {
    if (command === "emoji") {
        if (["add", "ad", "create"].includes(subCmd)) {
            await emoji.addEmoji(message, prefix);
        } else if (["delete", "delet", "del", "remove", "rm"].includes(subCmd)) {
            await emoji.removeEmoji(message);
        } else if (["edit", "e", "rename", "rn"].includes(subCmd)) {
            await emoji.renameEmoji(message, prefix);
        } else if (["link"].includes(subCmd)) {
            await emoji.linkEmoji(message);
        } else if (["search", "s"].includes(subCmd)) {
            await emoji.searchEmojis(message);
        }
    } else if (command === "db") {
        if (["insert", "ins", "in"].includes(subCmd)) {
            await db.insert(message);
        } else if (["update", "up", "upd"].includes(subCmd)) {
            await db.update(message);
        } else if (["delete", "delet", "del", "remove", "rm"].includes(subCmd)) {
            await db.deleteDoc(message);
        }
    } else if (["status", "stat"].includes(command)) await db.insertStatus(message);
    else if (["commands", "command", "comm", "com", "help"].includes(command))
        await misc.helpCmd(message, prefix);
    else if (["convert", "conv", "c"].includes(command)) await misc.convert(message, prefix);
    else if (["avatar", "pfp"].includes(command)) await misc.avatar(message);
    else if (command === "currencies") await misc.listCurrencies(message);
    else if (command === "bye") await misc.bye(message);
    else if (command === "urban") await misc.urban(message, prefix);
    else if (command === "beautiful") await imgProcess.beautiful(message);
    else if (command === "resize") await imgProcess.resizeImg(message, prefix);
    else if (command === "imgur") await imgProcess.imgur({ message, prefix });
    else if (command === "profile") await reddit.profile(message, prefix);
    else if (command === "sub") await reddit.sub(message, prefix);
    else if (command === "prefix") await db.updatePrefix(message);
    else if (command === "con") await misc.consoleCmd(message);
    else if (command === "qr") await imgProcess.qrCode(message);
    else if (command === "js") await misc.jsEval(message);
    else if (command === "link") await emoji.linkEmoji(message);
    else if (command === "leet") await misc.leet(message);
    else if (command === "pull") await misc.gitPull(message);
    else if (command === "calc") await misc.jsEval(message, "math");
    else if (command === "py") await misc.consoleCmd(message, undefined, true);
    else if (command === "someone") await misc.pingRandomMembers(message);
}
