import "@total-typescript/ts-reset";
import { Client, GatewayIntentBits, Partials, type TextChannel } from "discord.js";
import { existsSync, rmSync } from "node:fs";
import strftime from "strftime";
import { BOT_NAME, LOG_CHANNEL } from "./config.ts";
import handleInteraction from "./handlers/interactions.ts";
import handleMessage from "./handlers/messages.ts";
import dedent from "./helpers/dedent.ts";

import assert from "node:assert/strict";
import { migrateDb } from "./db/index.ts";
import { initialise, isDev, wipeTempFolders } from "./helpers/utils.ts";

const startTime = Date.now();

await migrateDb();

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

client.once("ready", async (c) => {
    const time = strftime("%d/%m/%Y %H:%M:%S");
    const doneLoadingTime = Date.now();

    assert(c.user, "Client user is undefined");

    console.log(`Started up in ${(doneLoadingTime - startTime) / 1000} seconds on ${time}`);
    console.log("Logged in as:");
    console.log(c.user.username);
    console.log(c.user.id);
    console.log("------------------");

    // Initialise handlers, statuses, etc
    await initialise(c);

    const logChannel = c.channels.cache.get(LOG_CHANNEL) as TextChannel;
    // const catFactChannel = c.channels.cache.get(CAT_FACT_CHANNEL) as TextChannel;
    // startCatFactLoop(catFactChannel);

    if (isDev()) return;
    if (existsSync(`/tmp/${BOT_NAME}_update.txt`)) {
        return rmSync(`/tmp/${BOT_NAME}_update.txt`);
    }

    await logChannel.send(dedent`
        Logged in as:
        ${c.user.username}
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
    process.on(signal, async () => {
        await client.destroy();
        console.log("Closed Discord connection");
        wipeTempFolders();
        console.log("Deleted temp folders");
        process.exit(0);
    });
}

await client.login(process.env.BOT_TOKEN);
