import * as tools from "./tools.js";
import * as emoji from "./emoji.js";
import * as imgProcess from "./imgProcess.js";
import * as reddit from "./reddit.js";
import * as database from "./database.js";
import { credentials } from "./config.js";
import { MessageEmbed } from "discord.js";
import { ObjectId } from "mongodb";
import fetch from "node-fetch";
import { mongoClient, client } from './app.js';
import { exec } from 'child_process';
export const botOwner = "258993932262834188";


export async function messageIn(message) {
    try {
        if (message.author.bot) return;
        const content = message.content.split(" ");
        let reactCmd;
        let subCmd;
        if (content.length > 1) {
            reactCmd = content[0].slice(1);
        }
        if (content.length >= 2) {
            subCmd = content[1];
        }

        const server = message.guild;
        const prefixColl = mongoClient.db("hifumi").collection("prefixes");

        if (await prefixColl.findOne({ serverId: server.id }) === null) {
            prefixColl.insertOne({ serverId: server.id, prefix: "h?" });
            await message.channel.send("I have set the prefix to `h?`");
        }

        const prefixDoc = await prefixColl.findOne({ serverId: server.id });
        const prefix = prefixDoc.prefix;
        const command = content[0].slice(prefix.length).toLowerCase();
        const lowerCasePrefix = content[0].substring(0, prefix.length).toLowerCase();

        if (message.content.toLowerCase().startsWith(lowerCasePrefix)) {
            if (["avatar", "pfp"].includes(command)) {
                await avatarURL(message);
                // if (command in ["avatar", "pfp"]) {
                //     await avatarURL(message);
            } else if (["convert", "conv", "c"].includes(command)) {
                await convert(message, prefix);
            } else if (command === "js") {
                await jsEval(message);
            } else if (command === "urban") {
                await urban(message);
            } else if (command === "emoji") {

                if (['add', 'ad', 'create'].includes(subCmd)) {
                    await emoji.addEmoji(message, prefix);
                } else if (['delete', 'delet', 'del', 'remove', 'rm'].includes(subCmd)) {
                    await emoji.removeEmoji(message, prefix);
                } else if (['edit', 'e', 'rename', "rn"].includes(subCmd)) {
                    await emoji.renameEmoji(message, prefix);
                }
            } else if (command === "sub") {
                await reddit.sub(message);
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
            } else if (command === "restart") {
                await restartBot(message);
            }
        }


        if (message.content.startsWith(`$${reactCmd} <@665224627353681921>`) || message.content.startsWith(`$${reactCmd} <@!665224627353681921>`)) {
            const reactionsColl = mongoClient.db("hifumi").collection("mikuReactions");
            const cmdAliases = await reactionsColl.findOne({ _id: ObjectId("61ed5a24955085f3e99f7c03") });
            const reactMsgs = await reactionsColl.findOne({ _id: ObjectId("61ed5cb4955085f3e99f7c0c") });

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
    } catch (err) {
        tools.errorLog(message, err)
    }
};


export async function reloadModules() {
    await import("./tools.js");
    await import("./emoji.js");
    await import("./imgProcess.js");
    await import("./reddit.js");
    await import("./database.js");
    await import("./config.js");

}


export async function restartBot(message) {
    if (!message.author.id === botOwner) {
        return await message.channel.send("Insuficient permissions!");
    }
    // await message.channel.send("Restarting...");
    await mongoClient.close();
    console.log("Disconnected the database");
    client.destroy();
    exec('node "./app.js"')
    process.exit();
}


async function jsEval(message) {
    const content = message.content.split(" ");
    if (message.author.id === botOwner) {
        if (content.length === 1) {
            return await message.channel.send("You have to type **SOMETHING** at least");
        }
        let cmd = "";
        for (let word of content.slice(1)) {
            cmd += word + " ";
        }
        const rslt = eval(cmd);
        if (rslt === null) {
            return await message.channel.send("Cannot send an empty message!");
        }

        if (rslt.toString().length === 0) {
            return await message.channel.send("Cannot send an empty message!");
        }
        if (rslt.toString().length > 2000) {
            return await message.channel.send("The result is too long for discord!");
        }
        await message.channel.send(rslt.toString());
    }
}


async function avatarURL(message) {

    const content = message.content.split(" ");
    if (content.length === 2) {
        if (isNaN(content[1]) && (!content[1].startsWith("<@"))) {
            return await message.channel.send("Invalid ID! Use numbers only please");
        }
    }

    const user = content.length === 1 ? message.author : await tools.getUserObjectPingId(message);
    const userID = user.id;
    const userName = user.username;
    const avatarHash = user.avatar;
    let url;

    if (user.avatarURL({ dynamic: true }).includes("gif")) {
        url = `https://cdn.discordapp.com/avatars/${userID}/${avatarHash}.gif?size=4096`;
    } else {
        url = `https://cdn.discordapp.com/avatars/${userID}/${avatarHash}.png?size=4096`;
    }

    const avatarEmbed = new MessageEmbed()
        .setColor(credentials["embedColour"])
        .setTitle(`*${userName}'s Avatar*`)
        .setImage(url);

    await message.channel.send({ embeds: [avatarEmbed] });
}

async function listCurrencies(message) {
    const currencies = await mongoClient.db("hifumi").collection("currencies").findOne({ _id: ObjectId("620bb1d76e6a2b90f475d556") });
    const title = 'List of currencies available for conversion'
    const columns = ["", "", ""]
    const currencyKeys = Object.keys(currencies).sort().slice(0, -1);

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
        .setColor(credentials["embedColour"])
        .setTitle(title)

    for (let i = 0; i < columns.length; i++) {
        currEmbed.addField('\u200b', columns[i], true);
    }

    await message.channel.send({ embeds: [currEmbed] });

}

async function convert(message, prefix) {
    const content = message.content.split(" ");

    const currencies = await mongoClient.db("hifumi").collection("currencies").findOne({ _id: ObjectId("620bb1d76e6a2b90f475d556") });

    if (!(1 <= content.length <= 3)) {
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
    const result = await response.json();

    // Checks for invalid inputs
    if (from === to) {
        return await message.channel.send("Your first currency is the same as your second currency!");
    } else if (amount < 0) {
        return await message.channel.send("You can't convert a negative amount!");
    } else if (amount === 0) {
        return await message.channel.send("Zero will obviously stay 0!");
    }

    const rate = result["conversion_rates"][to];
    const rslt = Math.round(amount * rate * 100) / 100;
    const description = `**${tools.advRound(amount)} ${from} ≈ ${tools.advRound(rslt)} ${to}**\n\nExchange Rate: 1 ${from} ≈ ${rate} ${to}`;

    const convertEmbed = new MessageEmbed()
        .setColor(credentials["embedColour"])
        .setTitle(`Converting ${from} to ${to}`)
        .setDescription(description)
        .setFooter({ text: `${tools.strftime("%d/%m/%Y %H:%M:%S")}` });

    await message.channel.send({ embeds: [convertEmbed] });
};


async function urban(message, prefix) {
    const content = message.content.split(" ");

    if (!content.length === 2) {
        return await message.channel.send(`Usage: \`${prefix}urban <word>\``);
    }
    const query = content[1];

    const response = await fetch(`https://api.urbandictionary.com/v0/define?term=${query}`);

    if (!response.ok) { return await message.channel.send("Error! Please try again later"); }
    const result = await response.json();

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
        .setColor(credentials["embedColour"])
        .setTitle(`*${word}*`)
        .setDescription(description)
        .setFooter({
            text: `Upvotes: ${upvotes} Downvotes: ${downvotes}`,
        });

    await message.channel.send({ embeds: [urbanEmbed] });
}


async function bye(message) {
    if (!message.author.id === botOwner) {
        return await message.channel.send("Insuficient permissions!");
    }
    await message.channel.send("Bai baaaaaaaai!!");
    await mongoClient.close();
    console.log("Disconnected the database");
    client.destroy();
    process.exit(0);
}

process.on("SIGINT", () => {
    mongoClient.close(() => {
        console.log("Disconnected the database");
        process.exit(0);
    });
});

