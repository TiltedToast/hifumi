import type { Message } from "discord.js";
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
        let prefix = DEFAULT_PREFIX;
        if (message.guild) prefix = prefixMap.get(message.guild.id) ?? DEFAULT_PREFIX;

        if (isDev()) prefix = DEV_PREFIX;

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

type MsgCommandFn = (message: Message) => Promise<unknown>;

type MsgCommandName = `${string}::${string}` | `.${string}`;

// prettier-ignore
/**
 * Map of commands and their functions.
 *
 * There are two ways to use this map:
 * 1. The command is a single word, prefixed with a `.`, e.g. ".status"
 * 2. The command is a combination of two words, e.g. "emoji::add"
 *
 * The first word is the command, the second word is the subcommand.
 * I don't know if this is the best way to do this, but it'll do for now
 */
const commands = new Map<MsgCommandName[], MsgCommandFn>([
    [[".status", ".stat"], db.insertStatus],
    [[".commands", ".command", ".comm", ".com", ".help"], misc.helpCmd],
    [[".avatar", ".pfp"], misc.avatar],
    [[".bye"], misc.bye],
    [[".beautiful"], imgProcess.beautiful],
    [[".resize"], imgProcess.resizeImg],
    [[".imgur"], imgProcess.imgur],
    [[".profile"], reddit.profile],
    [[".prefix"], db.updatePrefix],
    [[".con"], misc.cmdConsole],
    [[".qr"], imgProcess.qrCode],
    [[".js"], misc.jsEval],
    [[".link"], emoji.linkEmoji],
    [[".leet"], misc.leet],
    [[".pull"], misc.gitPull],
    [[".someone"], misc.pingRandomMembers],
    [[".yoink"], emoji.addEmoji],
    [[".db"], db.runSQL],
    [[".wolfram"], misc.wolframALpha],
    [[".calc", ".math"], misc.calc],
    [[".py"], misc.py],

    [["emoji::add", "emoji::ad", "emoji::create"], emoji.addEmoji],
    [["emoji::delete", "emoji::delet", "emoji::del", "emoji::remove", "emoji::rm"], emoji.removeEmoji],
    [["emoji::edit", "emoji::e", "emoji::rename", "emoji::rn"], emoji.renameEmoji],
    [["emoji::link"], emoji.linkEmoji],
    [["emoji::search", "emoji::s"], emoji.searchEmojis],
]);

async function handleCommand({ command, subCmd, message }: MessageCommandData) {
    for (const [cmd, fn] of commands) {
        if (cmd.includes(`${command}::${subCmd}`) || cmd.includes(`.${command}`)) {
            return await fn(message);
        }
    }
}
