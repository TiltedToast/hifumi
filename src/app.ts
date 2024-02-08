import dedent from "dedent";
import {
    Client as DiscordClient,
    GatewayIntentBits,
    Partials,
    type Snowflake,
    TextChannel,
} from "discord.js";
import "dotenv/config";
import { existsSync, rmSync } from "node:fs";
import strftime from "strftime";
import { avoidDbSleeping, startStatusLoop } from "./commands/loops.ts";
import { LOG_CHANNEL } from "./config.ts";
import { db } from "./db/index.ts";
import { prefixes, statuses } from "./db/schema.ts";
import type { Status } from "./db/types.ts";
import handleInteraction from "./handlers/interactions.ts";
import handleMessage from "./handlers/messages.ts";
import { isDev } from "./helpers/utils.ts";

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
    if (existsSync("./update.txt")) return rmSync("./update.txt");

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
for (const signal of stopSignals) {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    process.on(signal, async () => {
        await client.destroy();
        console.log("Closed Discord connection");
        process.exit(0);
    });
}

await client.login(process.env.BOT_TOKEN);
