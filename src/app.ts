import {
    Client as DiscordClient,
    GatewayIntentBits,
    Partials,
    Snowflake,
    TextChannel,
} from "discord.js";
import "dotenv/config";
import { existsSync, rmSync } from "node:fs";
import strftime from "strftime";
import { avoidDbSleeping, startStatusLoop } from "./commands/loops.js";
import { LOG_CHANNEL } from "./config.js";
import { db } from "./db/index.js";
import { prefixes, statuses } from "./db/schema.js";
import type { Status } from "./db/types.js";
import handleInteraction from "./handlers/interactions.js";
import handleMessage from "./handlers/messages.js";
import { isDev } from "./helpers/utils.js";
import dedent from "dedent";

const startTime = Date.now();

export const client = new DiscordClient({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
});
export const prefixMap = new Map<Snowflake, string>();
export let statusArr: Status[] = [];
export let botIsLoading = true;

client.once("ready", async () => {
    const time = strftime("%d/%m/%Y %H:%M:%S");
    const doneLoadingTime = Date.now();

    if (!client.user) return;

    console.log(`Started up in ${(doneLoadingTime - startTime) / 1000} seconds on ${time}`);
    console.log("Logged in as:");
    console.log(client.user.username);
    console.log(client.user.id);
    console.log("------------------");

    // Puts all statuses into an array to avoid reading the database on every status change
    statusArr = await db.select().from(statuses);

    if (statusArr.length) startStatusLoop(client).catch(console.error);
    avoidDbSleeping().catch(console.error);

    for (const prefixDoc of await db.select().from(prefixes)) {
        prefixMap.set(prefixDoc.serverId, prefixDoc.prefix);
    }
    botIsLoading = false;

    const logChannel = client.channels.cache.get(LOG_CHANNEL) as TextChannel;
    // const catFactChannel = client.channels.cache.get(CAT_FACT_CHANNEL) as TextChannel;
    // startCatFactLoop(catFactChannel);

    if (isDev()) return;
    if (existsSync("./temp/update.txt")) return rmSync("./temp/update.txt");

    await logChannel.send(dedent`
        Logged in as:
        ${client.user.username}
        Time: ${time}
        --------------------------
        `);
});

client.on("messageCreate", handleMessage);
client.on("interactionCreate", handleInteraction);
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

// Linux doesn't allow you to listen to SIGKILL
// This is only useful for development anyway
// Which happens on Windows
const stopSignals = ["SIGTERM", "SIGINT"];
if (process.platform === "win32") {
    stopSignals.push("SIGKILL");
}

// Graceful Shutdown on Ctrl + C / Docker stop
stopSignals.forEach((signal) => {
    process.on(signal, async () => {
        await client.destroy();
        console.log("Closed Discord connection");
        process.exit(0);
    });
});

await client.login(process.env.BOT_TOKEN);
