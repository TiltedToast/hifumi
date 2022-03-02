import * as tools from "./tools.js";
import * as emoji from "./emoji.js";
import * as imgProcess from "./imgProcess.js";
import * as reddit from "./reddit.js";
import * as database from "./database.js";

import { credentials } from "./config.js";
import fetch from "node-fetch";
import { exec } from 'child_process';
import { Client, Intents, Message, MessageEmbed, Permissions, TextChannel } from "discord.js";
import { MongoClient, ObjectId } from "mongodb";
import strftime from 'strftime';


export const botOwner: string = "258993932262834188";
export const embedColour: any = "0xce3a9b";
const allIntents = new Intents(32767);
export const client: Client = new Client({ intents: allIntents });
export const mongoClient: MongoClient = new MongoClient(credentials["mongoURI"]);
const startTime = Date.now();
export let prefixDict: any = {};
export let statusArr: any[] = [];

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
    const statusDocs = await mongoClient.db("hifumi").collection("statuses").find().toArray();
    statusArr = statusDocs

    const randomStatusDoc = tools.randomElementArray(statusArr);
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

    const channel = client.channels.cache.get('655484804405657642');
    (channel as TextChannel).send(`Logged in as:\n${client.user.username}\nTime: ${time}\n--------------------------`);
});


client.on("messageCreate", async (message: Message) => {
    let reactCmd: string = '', subCmd: string = '';
    if (message.guild === null || message.guild.me === null) return;
    try {
        // Permission check for the channel which the message was sent in to avoid breaking the bot
        if (message.author.bot || !message.guild.me.permissionsIn(message.channel.id).has("SEND_MESSAGES")
            || !message.guild.me.permissionsIn(message.channel.id).has("VIEW_CHANNEL")) return;

        const content: Array<string> = message.content.split(" ");

        // Sub command check for reacting to Miku's emote commands
        if (content.length > 1) {
            reactCmd = content[0].slice(1);
        }
        if (content.length >= 2) {
            subCmd = content[1];
        }

        const server = message.guild;
        const prefixColl = mongoClient.db("hifumi").collection("prefixes");

        // Adds a default prefix to the db if it doesn't exist
        if (!message.author.bot && !(server.id in prefixDict)) {
            prefixColl.insertOne({ serverId: server.id, prefix: "h!" });
            prefixDict[server.id] = "h!";
            await message.channel.send("I have set the prefix to `h!`");
        }

        // Gets the prefix from the db and compares to the message's beginning 
        // This way the prefix can be case insensitive
        const prefix = prefixDict[server.id] !== null ? prefixDict[server.id] : "h!";
        const command = content[0].slice(prefix.length).toLowerCase();
        const lowerCasePrefix = content[0].substring(0, prefix.length).toLowerCase();

        if (message.content.toLowerCase() === "hr~") await reloadBot(message);

        if (lowerCasePrefix === prefix.toLowerCase()) {
            if (["avatar", "pfp"].includes(command)) {
                await avatarURL(message);
            } else if (["convert", "conv", "c"].includes(command)) {
                await convert(message, prefix);
            } else if (command === "js") {
                await jsEval(message);
            } else if (command === "emoji") {

                if (['add', 'ad', 'create'].includes(subCmd)) {
                    await emoji.addEmoji(message, prefix);
                } else if (['delete', 'delet', 'del', 'remove', 'rm'].includes(subCmd)) {
                    await emoji.removeEmoji(message, prefix);
                } else if (['edit', 'e', 'rename', "rn"].includes(subCmd)) {
                    await emoji.renameEmoji(message, prefix);
                }
            } else if (command === "db") {
                if (["insert", "ins", "in"].includes(subCmd)) {
                    await database.insert(message);
                } else if (["update", "up", "upd"].includes(subCmd)) {
                    await database.update(message);
                }

            } else if (["status", "stat"].includes(command)) {
                await database.insertStatus(message);
            } else if (command === "currencies") {
                await listCurrencies(message);
            } else if (command === "bye") {
                await bye(message);
            } else if (command === "urban") {
                await urban(message, prefix);
            } else if (command === "beautiful") {
                await imgProcess.beautiful(message);
            } else if (command === "resize") {
                await imgProcess.resizeImg(message, prefix);
            } else if (command === "imgur") {
                await imgProcess.imgur(message, prefix);
            } else if (command === "profile") {
                await reddit.profile(message, prefix);
            } else if (command === "sub") {
                await reddit.sub(message, prefix);
            } else if (command === "prefix") {
                await database.updatePrefix(message);
            } else if (command === "con") {
                await console_cmd(message);
            } else if (['commands', 'command', 'comm', 'com', 'help'].includes(command)) {
                await helpCmd(message, prefix);
            }
        }

        // Reacting to Miku's emote commands
        // Grabs a random reply from the db and sents it as a message after a fixed delay
        if (message.content.startsWith(`$${reactCmd} <@641409330888835083>`) || message.content.startsWith(`$${reactCmd} <@!641409330888835083>`)) {
            const reactionsColl = mongoClient.db("hifumi").collection("mikuReactions");
            const cmdAliases = await reactionsColl.findOne({ _id: new ObjectId("61ed5a24955085f3e99f7c03") });
            const reactMsgs = await reactionsColl.findOne({ _id: new ObjectId("61ed5cb4955085f3e99f7c0c") });
            if (reactMsgs === null) return;

            for (const cmdType in cmdAliases) {
                if (Object.values(cmdAliases[cmdType]).includes(reactCmd)) {
                    const msg = tools
                        .randomElementArray(reactMsgs[cmdType])
                        .replace("{0}", message.author.username);
                    await tools.sleep(1000);
                    await message.channel.send(msg);
                }
            }
        }
    } catch (err: any) {
        tools.errorLog(message, err)
    }
});


async function helpCmd(message: Message, prefix: string) {
    let helpMsg = "";
    const helpMsgArray = await mongoClient.db("hifumi").collection("helpMsgs").find().sort({ cmd: 1 }).toArray();

    for (const helpMsgObj of helpMsgArray) {
        helpMsg += `**${prefix}${helpMsgObj.cmd}** - ${helpMsgObj.desc}\n`;
    }

    const helpEmbed = new MessageEmbed()
        .setColor(embedColour)
        .setTitle("**Hifumi's commands**")
        .setDescription(helpMsg);

    return await message.channel.send({ embeds: [helpEmbed] });
}


async function console_cmd(message: Message) {
    if (!(message.author.id === botOwner)) {
        return await message.channel.send("Insuficient permissions!");
    }
    // Creates a new string with the message content without the command
    // And runs it in a new shell process
    const command = message.content.split(" ").slice(1).join(" ");
    exec(command, async (stdout, stderr) => {
        if (stderr) {
            return message.channel.send(`\`\`\`${stderr}\`\`\``);
        }
        const msg = stdout ? `\`\`\`${stdout}\`\`\`` : "Command executed!";
        await message.channel.send(msg);
    });
}


export async function reloadBot(message: Message) {
    if (!(message.author.id === botOwner)) {
        return await message.channel.send("Insuficient permissions!");
    }
    // Reloads the bot using the pm2 module
    await mongoClient.close();
    exec("npm run restart")
    await message.channel.send("Reload successful!");
    client.destroy();
}


async function jsEval(message: Message) {
    const content = message.content.split(" ");
    if (message.author.id === botOwner) {
        if (content.length === 1) {
            return await message.channel.send("You have to type **SOMETHING** at least");
        }

        // Creates a new string with the message content without the command
        // And evalutes it via the JS engine
        // Checks for a valid length and sends the result
        const command = message.content.split(" ").slice(1).join(" ");
        const rslt = eval(command);

        if (rslt === null) {
            return await message.channel.send("Cannot send an empty message!");
        }
        const rsltString = rslt.toString()

        switch (true) {
            case (rsltString.length === 0):
                return await message.channel.send("Cannot send an empty message!");
            case (rsltString.length > 2000):
                return await message.channel.send("The result is too long for discord!");
            default:
                return await message.channel.send(rsltString);
        }
    }
}


async function avatarURL(message: Message) {
    // Checks for invalid provided User ID
    let url: string;
    const content = message.content.split(" ");
    if (content.length === 2) {
        if (isNaN(parseInt(content[1])) && (!content[1].startsWith("<@"))) {
            return await message.channel.send("Invalid ID! Use numbers only please");
        }
    }

    const user = content.length === 1 ? message.author : await tools.getUserObjectPingId(message);
    if (user === null || user === undefined) return

    const userID = user.id;
    const userName = user.username;
    const avatarHash = user.avatar;
    const avatarURL = user.avatarURL({ dynamic: true });

    if ((avatarURL as string).includes("gif")) {
        url = `https://cdn.discordapp.com/avatars/${userID}/${avatarHash}.gif?size=4096`;
    } else {
        url = `https://cdn.discordapp.com/avatars/${userID}/${avatarHash}.png?size=4096`;
    }

    const avatarEmbed = new MessageEmbed()
        .setColor(embedColour)
        .setTitle(`*${userName}'s Avatar*`)
        .setImage(url);

    await message.channel.send({ embeds: [avatarEmbed] });
}

async function listCurrencies(message: Message) {
    const currencies = await mongoClient.db("hifumi").collection("currencies").findOne({ _id: new ObjectId("620bb1d76e6a2b90f475d556") });
    if (currencies === null) return;
    const title = 'List of currencies available for conversion'
    const columns = ["", "", ""]
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

    const currEmbed = new MessageEmbed()
        .setColor(embedColour)
        .setTitle(title)

    // Loops over the columns and adds them to the embed
    for (let i = 0; i < columns.length; i++) {
        currEmbed.addField('\u200b', columns[i], true);
    }

    await message.channel.send({ embeds: [currEmbed] });

}

async function convert(message: Message, prefix: string): Promise<any> {
    const content: Array<string> = message.content.split(" ");

    const currencies = await mongoClient.db("hifumi").collection("currencies").findOne({ _id: new ObjectId("620bb1d76e6a2b90f475d556") });
    if (currencies === null) return;

    if (!(content.length === 4)) {
        return await message.channel.send(`Usage: \`${prefix}convert <amount of money> <cur1> <cur2>\``);
    }

    const amount = parseFloat(content[1]);
    const from = content[2].toUpperCase();
    const to = content[3].toUpperCase();

    if (!(from in currencies) || !(to in currencies)) {
        return await message.channel.send(`Invalid currency codes! Check \`${prefix}currencies\` for a list`);
    }

    const response = await fetch(`https://prime.exchangerate-api.com/v5/${credentials["exchangeApiKey"]}/latest/${from}`);

    if (!response.ok) { return await message.channel.send("Error! Please try again later"); }
    const result: any = await response.json();

    // Checks for possible pointless conversions
    if (from === to) {
        return await message.channel.send("Your first currency is the same as your second currency!");
    } else if (amount < 0) {
        return await message.channel.send("You can't convert a negative amount!");
    } else if (amount === 0) {
        return await message.channel.send("Zero will obviously stay 0!");
    }

    // Calculates the converted amount and sends it via an Embed
    const rate: number = result["conversion_rates"][to];
    const rslt = Math.round(amount * rate * 100) / 100;
    const description = `**${tools.advRound(amount)} ${from} ≈ ${tools.advRound(rslt)} ${to}**\n\nExchange Rate: 1 ${from} ≈ ${rate} ${to}`;

    const convertEmbed = new MessageEmbed()
        .setColor(embedColour)
        .setTitle(`Converting ${from} to ${to}`)
        .setDescription(description)
        .setFooter({ text: `${strftime("%d/%m/%Y %H:%M:%S")}` });

    await message.channel.send({ embeds: [convertEmbed] });
};


async function urban(message: Message, prefix: string): Promise<any> {
    const content = message.content.split(" ");

    if (!(content.length === 2)) {
        return await message.channel.send(`Usage: \`${prefix}urban <word>\``);
    }
    const query: string = content[1];

    const response = await fetch(`https://api.urbandictionary.com/v0/define?term=${query}`);

    if (!response.ok) { return await message.channel.send("Error! Please try again later"); }
    const result: any = await response.json();

    if (result["list"].length === 0) {
        return message.channel.send("No results found!");
    }

    const def = tools.randomElementArray(result["list"]);

    const word = def["word"];
    const definition = def["definition"];
    const example = def["example"];
    const author = def["author"];
    const permalink = def["permalink"];
    const upvotes = def["thumbs_up"];
    const downvotes = def["thumbs_down"];
    const description = `${definition}\n\n**Example:** ${example}\n\n**Author:** ${author}\n\n**Permalink:** [${permalink}](${permalink})`.replace(/\]|\[/g, "")

    const urbanEmbed = new MessageEmbed()
        .setColor(embedColour)
        .setTitle(`*${word}*`)
        .setDescription(description)
        .setFooter({
            text: `Upvotes: ${upvotes} Downvotes: ${downvotes}`,
        });

    await message.channel.send({ embeds: [urbanEmbed] });
}


async function bye(message: Message): Promise<any> {
    if (!(message.author.id === botOwner)) {
        return await message.channel.send("Insuficient permissions!");
    }
    // Closes the MongoDB connection and stops the running daemon via pm2
    await message.channel.send("Bai baaaaaaaai!!");
    await mongoClient.close();
    client.destroy();
    exec("pm2 delete hifumi");
}

// Makes sure Ctrl + C shuts down the bot properly
process.on("SIGINT", () => {
    mongoClient.close(() => {
        process.exit(0);
    });
});

client.login(credentials["token"]);
