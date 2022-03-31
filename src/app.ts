import "dotenv/config";
import * as tools from "./tools.js";
import * as emoji from "./emoji.js";
import * as imgProcess from "./imgProcess.js";
import * as reddit from "./reddit.js";
import * as database from "./database.js";
import fetch from "node-fetch";
import { exec } from "child_process";
import { isDev } from "./tools.js";
import strftime from "strftime";
import { Document, MongoClient, ObjectId } from "mongodb";
import { ConvertResult, StatusDoc, UrbanEntry, UrbanResult } from "./interfaces.js";
import { Client, Intents, Message, MessageEmbed, TextChannel } from "discord.js";
import { BOT_TOKEN, BOT_OWNER, EMBED_COLOUR, MONGO_URI, EXCHANGE_API_KEY } from "./config.js";

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

    const randomStatusDoc = tools.randomElementArray(statusArr) as StatusDoc;
    const randomType = randomStatusDoc.type;
    const randomStatus = randomStatusDoc.status;

    client.user.setActivity(randomStatus, { type: randomType });
    await tools.setRandomStatus(client);

    // Gets all prefixes from the database and puts them into a dictionary to avoid reading
    // The database every time a message is received
    const prefixDocs = await mongoClient.db("hifumi").collection("prefixes").find().toArray();
    for (const prefixDoc of prefixDocs) {
        prefixDict[prefixDoc.serverId] = prefixDoc.prefix;
    }

    if (!isDev()) {
        const channel = client.channels.cache.get("655484804405657642");
        await (channel as TextChannel).send(
            `Logged in as:\n${client.user.username}\nTime: ${time}\n--------------------------`
        );
    }
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
            else if (["avatar", "pfp"].includes(command)) await avatarURL(message);
            else if (command === "currencies") await listCurrencies(message);
            else if (command === "bye") await bye(message);
            else if (command === "urban") await urban(message, prefix);
            else if (command === "beautiful") await imgProcess.beautiful(message);
            else if (command === "resize") await imgProcess.resizeImg(message, prefix);
            else if (command === "imgur") await imgProcess.imgur(message, prefix);
            else if (command === "profile") await reddit.profile(message, prefix);
            else if (command === "sub") await reddit.sub(message, prefix);
            else if (command === "prefix") await database.updatePrefix(message);
            else if (command === "con") await console_cmd(message);
            else if (command === "qr") await imgProcess.qrCode(message);
            else if (command === "js") await jsEval(message);
        }

        // Reacting to Miku's emote commands
        // Grabs a random reply from the db and sents it as a message after a fixed delay

        const botId = isDev() ? "665224627353681921" : "641409330888835083";

        if (
            message.content.startsWith(`$${reactCmd} <@${botId}>`) ||
            message.content.startsWith(`$${reactCmd} <@!${botId}>`)
        ) {
            const reactionsColl = mongoClient.db("hifumi").collection("mikuReactions");
            const cmdAliases = await reactionsColl.findOne({ _id: new ObjectId("61ed5a24955085f3e99f7c03") });
            const reactMsgs = await reactionsColl.findOne({ _id: new ObjectId("61ed5cb4955085f3e99f7c0c") });

            if (cmdAliases === null || reactMsgs === null) {
                await message.channel.send("Couldn't find the necessary entries in the database");
                return;
            }

            for (const cmdType in cmdAliases) {
                if (Object.values(cmdAliases[cmdType]).includes(reactCmd)) {
                    const msg = (tools.randomElementArray(reactMsgs[cmdType]) as string).replace(
                        "{0}",
                        message.author.username
                    );
                    await tools.sleep(1000);
                    await message.channel.send(msg);
                }
            }
        }
    } catch (err: unknown) {
        tools.errorLog(message, err as Error);
    }
});

async function helpCmd(message: Message, prefix: string) {
    let helpMsg = "";
    const helpMsgArray = await mongoClient.db("hifumi").collection("helpMsgs").find().sort({ cmd: 1 }).toArray();

    for (const helpMsgObj of helpMsgArray) {
        helpMsg += `**${prefix}${helpMsgObj.cmd}** - ${helpMsgObj.desc}\n`;
    }

    const helpEmbed = new MessageEmbed()
        .setColor(EMBED_COLOUR)
        .setTitle("**Hifumi's commands**")
        .setDescription(helpMsg);

    return await message.channel.send({ embeds: [helpEmbed] });
}

async function console_cmd(message: Message) {
    if (message.author.id !== BOT_OWNER) return;
    // Creates a new string with the message content without the command
    // And runs it in a new shell process
    const command = message.content.split(" ").slice(1).join(" ");
    exec(command, async (err, stdout, stderr) => {
        if (stderr) await message.channel.send(`\`\`\`${stderr}\`\`\``);
        if (err) tools.errorLog(message, err);

        const msg = stdout ? `\`\`\`${stdout}\`\`\`` : "Command executed!";

        if (msg.length > 2000) return await message.channel.send("Command output too long!");
        return await message.channel.send(msg);
    });
}

export async function reloadBot(message: Message) {
    if (message.author.id !== BOT_OWNER) return;
    // Reloads the bot using the pm2 module
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
    const rslt = eval(command);

    if (!rslt) return await message.channel.send("Cannot send an empty message!");

    const resultLength = rslt.toString().length;

    if (!rslt.toString() || resultLength > 2000)
        return await message.channel.send("Invalid message length for discord!");
    return await message.channel.send(rslt);
}

async function avatarURL(message: Message) {
    // Checks for invalid provided User ID
    let url: string;
    const content = message.content.split(" ");
    if (content.length === 2) {
        if (isNaN(parseInt(content[1])) && !content[1].startsWith("<@")) {
            return await message.channel.send("Invalid ID! Use numbers only please");
        }
    }

    const user = content.length === 1 ? message.author : await tools.getUserObjectPingId(message);
    if (!user) {
        return await message.channel.send(
            "Couldn't find the specified User, Discord may be having issues with their API"
        );
    }

    const userID = user.id;
    const userName = user.username;
    const avatarHash = user.avatar;
    const avatarURL = user.avatarURL({ dynamic: true });

    if (!avatarURL) return await message.channel.send("No avatar found!");

    if (avatarURL.includes("gif")) {
        url = `https://cdn.discordapp.com/avatars/${userID}/${avatarHash}.gif?size=4096`;
    } else {
        url = `https://cdn.discordapp.com/avatars/${userID}/${avatarHash}.png?size=4096`;
    }

    const avatarEmbed = new MessageEmbed().setColor(EMBED_COLOUR).setTitle(`*${userName}'s Avatar*`).setImage(url);

    await message.channel.send({ embeds: [avatarEmbed] });
}

async function listCurrencies(message: Message) {
    const currencies = await mongoClient
        .db("hifumi")
        .collection("currencies")
        .findOne({ _id: new ObjectId("620bb1d76e6a2b90f475d556") });

    if (currencies === null) return await message.channel.send("Couldn't find any currencies in the database");

    const title = "List of currencies available for conversion";
    const columns = ["", "", ""];
    const currencyKeys = Object.keys(currencies).sort().slice(0, -1);

    // Equally divides the currencies into 3 columns
    for (let i = 0; i < currencyKeys.length; i++) {
        if (i <= 16) {
            columns[0] += `**${currencyKeys[i]}** - ${currencies[currencyKeys[i]]}\n`;
        } else if (17 <= i && i <= 33) {
            columns[1] += `**${currencyKeys[i]}** - ${currencies[currencyKeys[i]]}\n`;
        } else {
            columns[2] += `**${currencyKeys[i]}** - ${currencies[currencyKeys[i]]}\n`;
        }
    }

    const currEmbed = new MessageEmbed().setColor(EMBED_COLOUR).setTitle(title);

    // Loops over the columns and adds them to the embed
    for (let i = 0; i < columns.length; i++) {
        currEmbed.addField("\u200b", columns[i], true);
    }

    await message.channel.send({ embeds: [currEmbed] });
}

async function convert(message: Message, prefix: string): Promise<Message | undefined> {
    const content = message.content.split(" ");

    if (content.length !== 4)
        return await message.channel.send(`Usage: \`${prefix}convert <amount of money> <cur1> <cur2>\``);

    const currencies = await mongoClient
        .db("hifumi")
        .collection("currencies")
        .findOne({ _id: new ObjectId("620bb1d76e6a2b90f475d556") });

    if (currencies === null) return await message.channel.send("Couldn't find any currencies in the database");

    const amount = parseFloat(content[1]);
    const from = content[2].toUpperCase();
    const to = content[3].toUpperCase();

    if (!(from in currencies) || !(to in currencies)) {
        return await message.channel.send(`Invalid currency codes! Check \`${prefix}currencies\` for a list`);
    }

    const response = await fetch(`https://prime.exchangerate-api.com/v5/${EXCHANGE_API_KEY}/latest/${from}`);
    if (!response.ok) return await message.channel.send("Error! Please try again later");
    const result = (await response.json()) as ConvertResult;

    // Checks for possible pointless conversions
    if (from === to) return await message.channel.send("Your first currency is the same as your second currency!");
    if (amount < 0) return await message.channel.send("You can't convert a negative amount!");
    if (amount === 0) return await message.channel.send("Zero will obviously stay 0!");

    // Calculates the converted amount and sends it via an Embed
    const rate = result["conversion_rates"][to];
    const rslt = Math.round(amount * rate * 100) / 100;
    const description = `**${tools.advRound(amount)} ${from} ≈ ${tools.advRound(
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

    const result = (await response.json()) as UrbanResult;

    if (result["list"].length === 0) return message.channel.send("No results found!");

    const def = tools.randomElementArray(result["list"]) as UrbanEntry;

    const word = def["word"];
    const definition = def["definition"];
    const example = def["example"];
    const author = def["author"];
    const permalink = def["permalink"];
    const upvotes = def["thumbs_up"];
    const downvotes = def["thumbs_down"];
    const description = `${definition}\n
        **Example:** ${example}\n
        **Author:** ${author}\n
        **Permalink:** [${permalink}](${permalink})`.replace(/\]|\[/g, "");

    const urbanEmbed = new MessageEmbed()
        .setColor(EMBED_COLOUR)
        .setTitle(`*${word}*`)
        .setDescription(description)
        .setFooter({ text: `Upvotes: ${upvotes} Downvotes: ${downvotes}` });

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
process.on("SIGINT", () => {
    mongoClient.close(() => {
        console.log("Closed MongoDB connection");
        client.destroy();
        console.log("Closed Discord client");
        process.exit(0);
    });
});

client.login(BOT_TOKEN);
