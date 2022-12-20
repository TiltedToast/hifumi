import {
    Client as DiscordClient,
    EmbedBuilder,
    GatewayIntentBits,
    Partials,
    Snowflake,
    TextChannel,
} from "discord.js";
import "dotenv/config";
import { existsSync, rmSync } from "fs";
import { MongoClient } from "mongodb";
import strftime from "strftime";
import { startStatusLoop } from "./commands/loops.js";
import { BOT_TOKEN, EMBED_COLOUR, LOG_CHANNEL, MONGO_URI } from "./config.js";
import handleInteraction from "./handlers/interactions.js";
import handleMessage from "./handlers/messages.js";
import type { StatusDoc } from "./helpers/types.js";
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
export const mongoClient = new MongoClient(MONGO_URI);
export const prefixes = new Map<Snowflake, string>();
export let statusArr: StatusDoc[] = [];
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

    await mongoClient.connect();

    // Puts all statuses into an array to avoid reading the database on every status change
    statusArr = (await mongoClient
        .db("hifumi")
        .collection("statuses")
        .find()
        .toArray()) as StatusDoc[];

    if (statusArr.length) startStatusLoop(client);

    // Gets all prefixes from the database and puts them into a dictionary to avoid reading
    // The database every time a message is received
    const prefixDocs = await mongoClient.db("hifumi").collection("prefixes").find().toArray();
    for (const prefixDoc of prefixDocs) {
        prefixes.set(prefixDoc["serverId"], prefixDoc["prefix"]);
    }
    botIsLoading = false;

    const logChannel = client.channels.cache.get(LOG_CHANNEL) as TextChannel;
    // const catFactChannel = client.channels.cache.get(CAT_FACT_CHANNEL) as TextChannel;
    // startCatFactLoop(catFactChannel);

    const credentials = await getMissingCredentials();

    if (credentials.length > 0) {
        const missingCredentialsEmbed = new EmbedBuilder()
            .setColor(EMBED_COLOUR)
            .setTitle("Missing credentials")
            .setDescription(
                `The following credentials are missing:\n\n- ${credentials.join("\n- ")}`
            );

        await logChannel.send({ embeds: [missingCredentialsEmbed] });
    }

    if (isDev()) return;
    if (existsSync("./temp/update.txt")) return rmSync("./temp/update.txt");

    await logChannel.send(
        `Logged in as:\n${client.user.username}\nTime: ${time}\n--------------------------`
    );
});

client.on("messageCreate", handleMessage);
client.on("interactionCreate", handleInteraction);

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
        await mongoClient.close();
        console.log("Closed MongoDB connection");

        client.destroy();
        console.log("Closed Discord client");

        process.exit(0);
    });
});

client.login(BOT_TOKEN);
