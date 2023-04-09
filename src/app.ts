import { connect } from "@planetscale/database";
import {
    Client as DiscordClient,
    GatewayIntentBits,
    Partials,
    Snowflake,
    TextChannel,
} from "discord.js";
import "dotenv/config";
import { drizzle } from "drizzle-orm/planetscale-serverless/driver.js";
import { existsSync, rmSync } from "fs";
import strftime from "strftime";
import { startStatusLoop } from "./commands/loops.js";
import { BOT_TOKEN, LOG_CHANNEL, PLANETSCALE_URL } from "./config.js";
import { prefixes, statuses } from "./db/schema.js";
import type { Status } from "./db/types.js";
import handleInteraction from "./handlers/interactions.js";
import handleMessage from "./handlers/messages.js";
import { getMissingCredentials, isDev } from "./helpers/utils.js";

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

export const PSConnection = connect({ url: PLANETSCALE_URL });
export const db = drizzle(PSConnection, { logger: isDev() });

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
    statusArr = await db.select().from(statuses).execute();

    if (statusArr.length) startStatusLoop(client);

    for (const prefixDoc of await db.select().from(prefixes).execute()) {
        prefixMap.set(prefixDoc.serverId, prefixDoc.prefix);
    }
    botIsLoading = false;

    const logChannel = client.channels.cache.get(LOG_CHANNEL) as TextChannel;
    // const catFactChannel = client.channels.cache.get(CAT_FACT_CHANNEL) as TextChannel;
    // startCatFactLoop(catFactChannel);

    const credentials = await getMissingCredentials();

    if (credentials.length > 0) {
        console.error(`Missing credentials: ${credentials.join(", ")}`);
        console.error("Exiting...");
        client.destroy();
        process.exit(1);
    }

    if (isDev()) return;
    if (existsSync("./temp/update.txt")) return rmSync("./temp/update.txt");

    await logChannel.send(
        `Logged in as:\n${client.user.username}\nTime: ${time}\n--------------------------`
    );
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
        client.destroy();
        console.log("Closed Discord connection");
        process.exit(0);
    });
});

client.login(BOT_TOKEN);
