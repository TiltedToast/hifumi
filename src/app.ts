import "dotenv/config";
import strftime from "strftime";
import { isDev } from "./commands/tools.js";
import { Document, MongoClient } from "mongodb";
import { startCatFactLoop, startStatusLoop } from "./commands/loops.js";
import { Client, Intents, Message, MessageEmbed, TextChannel } from "discord.js";
import { getMissingCredentials } from "./commands/tools.js";
import { BOT_TOKEN, EMBED_COLOUR, MONGO_URI, CAT_FACT_CHANNEL, LOG_CHANNEL } from "./config.js";
import { handleMessage } from "./main.js";

if (!BOT_TOKEN) throw new Error("No bot token found! Make sure you have a BOT_TOKEN env variable set");

const intents = new Intents([
    "GUILDS",
    "GUILD_MEMBERS",
    "GUILD_EMOJIS_AND_STICKERS",
    "GUILD_MESSAGES",
    "GUILD_MESSAGE_REACTIONS",
]);

export const client = new Client({ intents });
export const mongoClient = new MongoClient(MONGO_URI);
const startTime = Date.now();
export const prefixDict: Record<string, string> = {};
export let statusArr: Document[] = [];

client.once("ready", async () => {
    const time = strftime("%d/%m/%Y %H:%M:%S");
    const doneLoadingTime = Date.now();

    if (!client.user) return;

    console.log(`Started up in ${(doneLoadingTime - startTime) / 1000} seconds on ${time}`);
    console.log("Logged in as:");
    console.log(client.user.username);
    console.log(client.user.id);
    console.log("------");

    await mongoClient.connect();

    // Puts all statuses into an array to avoid reading the database on every status change
    statusArr = await mongoClient.db("hifumi").collection("statuses").find().toArray();

    await startStatusLoop(client);

    // Gets all prefixes from the database and puts them into a dictionary to avoid reading
    // The database every time a message is received
    const prefixDocs = await mongoClient.db("hifumi").collection("prefixes").find().toArray();
    for (const prefixDoc of prefixDocs) {
        prefixDict[prefixDoc["serverId"]] = prefixDoc["prefix"];
    }

    const logChannel = client.channels.cache.get(LOG_CHANNEL);
    const catFactChannel = client.channels.cache.get(CAT_FACT_CHANNEL);
    await startCatFactLoop(catFactChannel as TextChannel);

    const credentials = await getMissingCredentials();

    if (credentials.length > 0) {
        const missingCredentialsEmbed = new MessageEmbed()
            .setColor(EMBED_COLOUR)
            .setTitle("Missing credentials")
            .setDescription(`The following credentials are missing:\n\n- ${credentials.join("\n- ")}`);

        await (logChannel as TextChannel).send({ embeds: [missingCredentialsEmbed] });
    }

    if (isDev()) return;

    await (logChannel as TextChannel).send(
        `Logged in as:\n${client.user.username}\nTime: ${time}\n--------------------------`
    );
});

client.on("messageCreate", async (message: Message) => {
    await handleMessage(message);
});

// Graceful Shutdown on Ctrl + C / Docker stop
process.on("SIGINT", async () => {
    await mongoClient.close();
    console.log("Closed MongoDB connection");

    client.destroy();
    console.log("Closed Discord client");

    process.exit(0);
});

client.login(BOT_TOKEN);
