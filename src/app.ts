import "dotenv/config";
import * as emoji from "./emoji.js";
import * as imgProcess from "./imgProcess.js";
import * as reddit from "./reddit.js";
import * as database from "./database.js";
import fetch from "node-fetch";
import { exec } from "child_process";
import { isDev } from "./tools.js";
import strftime from "strftime";
import { Document, MongoClient } from "mongodb";
import { ConvertResponse } from "./interfaces/ConvertResponse.js";
import { StatusDoc } from "./interfaces/StatusDoc.js";
import { UrbanEntry, UrbanResponse } from "./interfaces/UrbanResponse.js";
import { startCatFactLoop, startStatusLoop } from "./loops.js";
import { Client, Intents, Message, MessageEmbed, TextChannel, Util } from "discord.js";
import { randomElementArray, sleep, errorLog, getUserObjectPingId, advRound, getMissingCredentials } from "./tools.js";
import {
    BOT_TOKEN,
    BOT_OWNER,
    EMBED_COLOUR,
    MONGO_URI,
    EXCHANGE_API_KEY,
    CAT_FACT_CHANNEL,
    LOG_CHANNEL,
} from "./config.js";

if (!BOT_TOKEN) throw new Error("No bot token found! Make sure you have a BOT_TOKEN env variable set");

const allIntents = new Intents(32767);
export const client = new Client({ intents: allIntents });
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

    const randomStatusDoc = randomElementArray(statusArr) as StatusDoc;
    const randomType = randomStatusDoc.type;
    const randomStatus = randomStatusDoc.status;

    client.user.setActivity(randomStatus, { type: randomType });
    await startStatusLoop(client);

    // Gets all prefixes from the database and puts them into a dictionary to avoid reading
    // The database every time a message is received
    const prefixDocs = await mongoClient.db("hifumi").collection("prefixes").find().toArray();
    for (const prefixDoc of prefixDocs) {
        prefixDict[prefixDoc.serverId] = prefixDoc.prefix;
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
    if (message.guild?.me === null) return;
    try {
        // Permission check for the channel which the message was sent in to avoid breaking the bot
        if (
            message.author.bot ||
            !message.guild?.me.permissionsIn(message.channel.id).has("SEND_MESSAGES") ||
            !message.guild?.me.permissionsIn(message.channel.id).has("VIEW_CHANNEL")
        )
            return;

        const content = message.content.split(" ");

        // Sub command check for reacting to Miku's emote commands
        const reactCmd = content.length >= 1 ? content[0].slice(1) : "";
        const subCmd = content.length >= 2 ? content[1] : "";

        const server = message.guild;
        const prefixColl = mongoClient.db("hifumi").collection("prefixes");

        // Adds a default prefix to the db if it doesn't exist
        if (!(server.id in prefixDict) && !isDev()) {
            await prefixColl.insertOne({ serverId: server.id, prefix: "h!" });
            prefixDict[server.id] = "h!";
            await message.channel.send("I have set the prefix to `h!`");
        }

        // Gets the prefix from the db and compares to the message's beginning
        // This way the prefix can be case insensitive
        let prefix = prefixDict[server.id] ?? "h!";

        if (isDev()) prefix = "h?";

        const command = content[0].slice(prefix.length).toLowerCase();
        const lowerCasePrefix = content[0].substring(0, prefix.length).toLowerCase();

        if (message.content.toLowerCase() === "hr~~~" && !isDev()) await reloadBot(message);
        if (message.content.toLowerCase() === "hr~" && isDev()) await reloadBot(message);

        if (lowerCasePrefix === prefix.toLowerCase()) {
            if (command === "emoji") {
                if (["add", "ad", "create"].includes(subCmd)) {
                    await emoji.addEmoji(message, prefix);
                } else if (["delete", "delet", "del", "remove", "rm"].includes(subCmd)) {
                    await emoji.removeEmoji(message, prefix);
                } else if (["edit", "e", "rename", "rn"].includes(subCmd)) {
                    await emoji.renameEmoji(message, prefix);
                }
            } else if (command === "db") {
                if (["insert", "ins", "in"].includes(subCmd)) {
                    await database.insert(message);
                } else if (["update", "up", "upd"].includes(subCmd)) {
                    await database.update(message);
                }
            } else if (["status", "stat"].includes(command)) await database.insertStatus(message);
            else if (["commands", "command", "comm", "com", "help"].includes(command)) await helpCmd(message, prefix);
            else if (["convert", "conv", "c"].includes(command)) await convert(message, prefix);
            else if (["avatar", "pfp"].includes(command)) await avatar(message);
            else if (command === "currencies") await listCurrencies(message);
            else if (command === "bye") await bye(message);
            else if (command === "urban") await urban(message, prefix);
            else if (command === "beautiful") await imgProcess.beautiful(message);
            else if (command === "resize") await imgProcess.resizeImg(message, prefix);
            else if (command === "imgur") await imgProcess.imgur(message, prefix);
            else if (command === "profile") await reddit.profile(message, prefix);
            else if (command === "sub") await reddit.sub(message, prefix);
            else if (command === "prefix") await database.updatePrefix(message);
            else if (command === "con") await consoleCmd(message);
            else if (command === "qr") await imgProcess.qrCode(message);
            else if (command === "js") await jsEval(message);
            else if (command === "link") await emoji.linkEmoji(message);
            else if (command === "leet") await leet(message);
        }

        // Reacting to Miku's emote commands
        // Grabs a random reply from the db and sents it as a message after a fixed delay
        const botId = isDev() ? "665224627353681921" : "641409330888835083";

        if (
            message.content.startsWith(`$${reactCmd} <@${botId}>`) ||
            message.content.startsWith(`$${reactCmd} <@!${botId}>`)
        ) {
            const mikuReactions = await mongoClient.db("hifumi").collection("mikuReactions").find().toArray();

            if (mikuReactions.length === 0) {
                await message.channel.send("No Miku reactions found in the database");
                return;
            }

            const cmdAliases = mikuReactions[0];
            const reactMsgs = mikuReactions[1];

            for (const alias in cmdAliases) {
                if (Object.values(cmdAliases[alias]).includes(reactCmd)) {
                    const msg = (randomElementArray(reactMsgs[alias]) as string).replace(
                        "{0}",
                        message.author.username
                    );
                    await sleep(1000);
                    await message.channel.send(msg);
                }
            }
        }
    } catch (err: unknown) {
        errorLog(message, err as Error);
    }
});

async function leet(message: Message) {
    const inputWords = message.content.split(" ").slice(1);
    const leetDoc = (await mongoClient.db("hifumi").collection("leet").find().toArray())[0];

    if (leetDoc === null) return message.channel.send("Couldn't find the necessary entries in the database");

    const leetOutput = inputWords
        .map((word) => {
            return word
                .split("")
                .map((char) => {
                    if (char in leetDoc) return randomElementArray(leetDoc[char]);
                    return char;
                })
                .join("");
        })
        .join(" ");

    const splitOutput = Util.splitMessage(leetOutput, { maxLength: 2000, char: " " });

    for (const msg of splitOutput) {
        await message.channel.send(msg);
    }
}

async function helpCmd(message: Message, prefix: string) {
    const helpMsgArray = await mongoClient.db("hifumi").collection("helpMsgs").find().sort({ cmd: 1 }).toArray();
    if (helpMsgArray.length === 0)
        return await message.channel.send("Seems there aren't any help messages saved in the database");

    const helpMsg = helpMsgArray.map((helpMsgObj) => `**${prefix}${helpMsgObj.cmd}** - ${helpMsgObj.desc}`).join("\n");

    const helpEmbed = new MessageEmbed()
        .setColor(EMBED_COLOUR)
        .setTitle("**Hifumi's commands**")
        .setDescription(helpMsg);

    return await message.channel.send({ embeds: [helpEmbed] });
}

async function consoleCmd(message: Message) {
    if (message.author.id !== BOT_OWNER) return;
    // Creates a new string with the message content without the command
    // And runs it in a new shell process
    const command = message.content.split(" ").slice(1).join(" ");
    exec(command, async (_, stdout, stderr) => {
        if (stderr) await message.channel.send(`\`\`\`${stderr}\`\`\``);

        const msg = stdout ? `\`\`\`${stdout}\`\`\`` : "Command executed!";

        if (msg.length > 2000) return await message.channel.send("Command output too long!");
        return await message.channel.send(msg);
    });
}

export async function reloadBot(message: Message) {
    if (message.author.id !== BOT_OWNER) return;
    await mongoClient.close();

    exec("npm run restart");
    await message.channel.send("Reload successful!");
}

async function jsEval(message: Message) {
    if (message.author.id !== BOT_OWNER) return;

    const content = message.content.split(" ");

    if (content.length === 1) return await message.channel.send("You have to type **SOMETHING** at least");

    // Creates a new string with the message content without the command
    // And evalutes it via the JS engine
    // Checks for a valid length and sends the result
    const command = message.content.split(" ").slice(1).join(" ");
    let rslt = eval(command);

    if (typeof rslt === "object") rslt = `\`\`\`js\n${JSON.stringify(rslt, null, 4)}\n\`\`\``;
    if (!rslt) return await message.channel.send("Cannot send an empty message!");

    const resultString = rslt.toString();

    if (!resultString || resultString.length > 2000)
        return await message.channel.send("Invalid message length for discord!");
    return await message.channel.send(resultString);
}

async function avatar(message: Message) {
    // Checks for invalid provided User ID
    let url: string;
    const content = message.content.split(" ");

    const user = content.length === 1 ? message.author : await getUserObjectPingId(message);
    if (!user) {
        return await message.channel.send("Couldn't find the specified User");
    }

    const { id: userId, username, avatar: avatarHash } = user;

    const avatarURL = user.avatarURL({ dynamic: true });

    if (!avatarURL) return await message.channel.send("No avatar found!");

    if (avatarURL.includes(".gif")) {
        url = `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.gif?size=4096`;
    } else {
        url = `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=4096`;
    }

    const avatarEmbed = new MessageEmbed().setColor(EMBED_COLOUR).setTitle(`*${username}'s Avatar*`).setImage(url);

    await message.channel.send({ embeds: [avatarEmbed] });
}

async function listCurrencies(message: Message) {
    const currencies = (await mongoClient.db("hifumi").collection("currencies").find().toArray())[0];

    if (currencies === null) return await message.channel.send("Couldn't find any currencies in the database");

    const title = "List of currencies available for conversion";
    const columns = ["", "", ""];
    const currencyKeys = Object.keys(currencies).sort().slice(0, -1);

    // Equally divides the currencies into 3 columns
    for (let i = 0; i < currencyKeys.length; i++) {
        if (i <= 17) {
            columns[0] += `**${currencyKeys[i]}** - ${currencies[currencyKeys[i]]}\n`;
        } else if (18 <= i && i <= 34) {
            columns[1] += `**${currencyKeys[i]}** - ${currencies[currencyKeys[i]]}\n`;
        } else {
            columns[2] += `**${currencyKeys[i]}** - ${currencies[currencyKeys[i]]}\n`;
        }
    }

    const currEmbed = new MessageEmbed().setColor(EMBED_COLOUR).setTitle(title);
    for (const column of columns) {
        currEmbed.addField("\u200b", column, true);
    }

    await message.channel.send({ embeds: [currEmbed] });
}

async function convert(message: Message, prefix: string): Promise<Message | undefined> {
    const content = message.content.split(" ");

    if (content.length !== 4)
        return await message.channel.send(`Usage: \`${prefix}convert <amount of money> <cur1> <cur2>\``);

    const currencies = (await mongoClient.db("hifumi").collection("currencies").find().toArray())[0];

    if (currencies === null) return await message.channel.send("Couldn't find any currencies in the database");

    const amount = parseFloat(content[1]);
    const from = content[2].toUpperCase();
    const to = content[3].toUpperCase();

    if (!(from in currencies) || !(to in currencies)) {
        return await message.channel.send(`Invalid currency codes! Check \`${prefix}currencies\` for a list`);
    }

    const response = await fetch(`https://prime.exchangerate-api.com/v5/${EXCHANGE_API_KEY}/latest/${from}`);
    if (!response.ok) return await message.channel.send("Error! Please try again later");
    const result = (await response.json()) as ConvertResponse;

    // Checks for possible pointless conversions
    if (from === to) return await message.channel.send("Your first currency is the same as your second currency!");
    if (amount < 0) return await message.channel.send("You can't convert a negative amount!");
    if (amount === 0) return await message.channel.send("Zero will obviously stay 0!");

    // Calculates the converted amount and sends it via an Embed
    const rate = result["conversion_rates"][to];
    const rslt = Math.round(amount * rate * 100) / 100;
    const description = `**${advRound(amount)} ${from} ≈ ${advRound(
        rslt
    )} ${to}**\n\nExchange Rate: 1 ${from} ≈ ${rate} ${to}`;

    const convertEmbed = new MessageEmbed()
        .setColor(EMBED_COLOUR)
        .setTitle(`Converting ${from} to ${to}`)
        .setDescription(description)
        .setFooter({ text: `${strftime("%d/%m/%Y %H:%M:%S")}` });

    await message.channel.send({ embeds: [convertEmbed] });
}

async function urban(message: Message, prefix: string): Promise<Message> {
    const content = message.content.split(" ");

    if (content.length !== 2) return await message.channel.send(`Usage: \`${prefix}urban <word>\``);

    const query = content[1];
    const response = await fetch(`https://api.urbandictionary.com/v0/define?term=${query}`);
    if (!response.ok) return await message.channel.send(`Error ${response.status}! Please try again later`);

    const result = ((await response.json()) as UrbanResponse)["list"];

    if (result.length === 0) return message.channel.send("No results found!");

    const resultEntry = randomElementArray(result) as UrbanEntry;

    const { word, definition, example, author, permalink, thumbs_up, thumbs_down } = resultEntry;

    const description = `${definition}\n
        **Example:** ${example}\n
        **Author:** ${author}\n
        **Permalink:** ${permalink}`.replace(/\]|\[/g, "");

    const urbanEmbed = new MessageEmbed()
        .setColor(EMBED_COLOUR)
        .setTitle(`*${word}*`)
        .setDescription(description)
        .setFooter({ text: `Upvotes: ${thumbs_up} Downvotes: ${thumbs_down}` });

    return await message.channel.send({ embeds: [urbanEmbed] });
}

async function bye(message: Message): Promise<Message | void> {
    if (message.author.id !== BOT_OWNER) return;

    // Closes the MongoDB connection and stops the running daemon via pm2
    await message.channel.send("Bai baaaaaaaai!!");
    await mongoClient.close();
    client.destroy();
    exec("pm2 delete hifumi");
}

// Graceful Shutdown on Ctrl + C / Docker stop
process.on("SIGINT", async () => {
    await mongoClient.close();
    console.log("Closed MongoDB connection");

    client.destroy();
    console.log("Closed Discord client");

    process.exit(0);
});

client.login(BOT_TOKEN);
