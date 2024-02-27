import dedent from "dedent";
import { Client, GatewayIntentBits, Partials, TextChannel } from "discord.js";
import { existsSync, rmSync } from "node:fs";
import strftime from "strftime";
import { avoidDbSleeping } from "./commands/loops.ts";
import { LOG_CHANNEL } from "./config.ts";
import handleInteraction from "./handlers/interactions.ts";
import handleMessage from "./handlers/messages.ts";
import * as prefixHandler from "./handlers/prefixes.ts";
import * as statusHandler from "./handlers/statuses.ts";
import { isDev, wipeTempFolders } from "./helpers/utils.ts";
import assert from "node:assert/strict";

const startTime = Date.now();

const client = new Client({
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

client.once("ready", async () => {
    const time = strftime("%d/%m/%Y %H:%M:%S");
    const doneLoadingTime = Date.now();

    assert(client.user, "Client user is undefined");

    console.log(`Started up in ${(doneLoadingTime - startTime) / 1000} seconds on ${time}`);
    console.log("Logged in as:");
    console.log(client.user.username);
    console.log(client.user.id);
    console.log("------------------");

    // Puts all statuses into an array to avoid reading the database on every status change
    await statusHandler.init().catch(console.error);
    statusHandler.startStatusLoop(client).catch(console.error);
    await prefixHandler.init().catch(console.error);
    prefixHandler.loadingDone();
    avoidDbSleeping().catch(console.error);

    const logChannel = client.channels.cache.get(LOG_CHANNEL) as TextChannel;
    // const catFactChannel = client.channels.cache.get(CAT_FACT_CHANNEL) as TextChannel;
    // startCatFactLoop(catFactChannel);

    if (isDev()) return;
    if (existsSync("/tmp/hifumi_update.txt")) return rmSync("/tmp/hifumi_update.txt");

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
const stopSignals: NodeJS.Signals[] = ["SIGTERM", "SIGINT"];
if (process.platform === "win32") {
    stopSignals.push("SIGKILL");
}

// Graceful Shutdown on Ctrl + C / Docker stop
for (const signal of stopSignals) {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    process.on(signal, async () => {
        await client.destroy();
        console.log("Closed Discord connection");
        await wipeTempFolders();
        console.log("Deleted temp folders");
        process.exit(0);
    });
}

await client.login(process.env.BOT_TOKEN);
