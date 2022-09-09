import "dotenv/config";
import strftime from "strftime";
import { isDev } from "./tools.js";
import { Document, MongoClient } from "mongodb";
import { startStatusLoop } from "./commands/loops.js";
import {
    Client as DiscordClient,
    GatewayIntentBits,
    Interaction,
    Message,
    TextChannel,
    EmbedBuilder,
    Partials,
} from "discord.js";
import { getMissingCredentials } from "./tools.js";
import { BOT_TOKEN, EMBED_COLOUR, MONGO_URI, LOG_CHANNEL } from "./config.js";
import handleInteraction from "./handlers/interactions.js";
import handleMessage from "./handlers/messages.js";

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
    console.log("------------------");

    await mongoClient.connect();

    // Puts all statuses into an array to avoid reading the database on every status change
    statusArr = await mongoClient.db("hifumi").collection("statuses").find().toArray();

    if (statusArr.length) await startStatusLoop(client);

    // Gets all prefixes from the database and puts them into a dictionary to avoid reading
    // The database every time a message is received
    const prefixDocs = await mongoClient.db("hifumi").collection("prefixes").find().toArray();
    for (const prefixDoc of prefixDocs) {
        prefixDict[prefixDoc["serverId"]] = prefixDoc["prefix"];
    }

    const logChannel = client.channels.cache.get(LOG_CHANNEL) as TextChannel;
    // const catFactChannel = client.channels.cache.get(CAT_FACT_CHANNEL) as TextChannel;
    // await startCatFactLoop(catFactChannel);

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

    await logChannel.send(
        `Logged in as:\n${client.user.username}\nTime: ${time}\n--------------------------`
    );
});

client.on("messageCreate", async (message: Message) => {
    await handleMessage(message);
});

client.on("interactionCreate", async (interaction: Interaction) => {
    await handleInteraction(interaction);
});

// Graceful Shutdown on Ctrl + C / Docker stop
["SIGTERM", "SIGINT"].forEach((signal) => {
    process.on(signal, async () => {
        await mongoClient.close();
        console.log("Closed MongoDB connection");

        client.destroy();
        console.log("Closed Discord client");

        process.exit(0);
    });
});

client.login(BOT_TOKEN);
