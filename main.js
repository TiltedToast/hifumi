import * as tools from "./tools.js";
import * as emoji from "./emoji.js";
import * as imgProcess from "./imgProcess.js";
import * as reddit from "./reddit.js";
import { credentials } from "./config.js";
import { MessageEmbed } from "discord.js";
import { ObjectId } from "mongodb";
import fetch from "node-fetch";
import { mongoClient } from './app.js';

const botOwner = "258993932262834188";


client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    const content = message.content.split();
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

    if (await prefixColl.findOne({ serverID: server.id }) === null) {
        prefixColl.insertOne({ serverID: server.id, prefix: "h?" });
        await message.channel.send("I have set the prefix to `h?`");
    }

    const prefixDoc = await prefixColl.findOne({ serverID: server.id });
    const prefix = prefixDoc.prefix;

    const command = content[0].slice(prefix.length).toLowerCase();

    if (message.content.startsWith(prefix)) {
        if (command in ["avatar", "pfp"]) {
            await avatarURL(message);
        } else if (command in ["convert", "conv", "c"]) {
            await convert(message, prefix);
        } else if (command === "js") {
            await jsEval(message);
        } else if (command === "urban") {
            await urban(message);
        } else if (command === "emoji") {

            if (subCmd in ['add', 'ad', 'create']) {
                await emoji.addEmoji(message);
            } else if (subCmd in [['delete', 'delet', 'del', 'remove', 'rm']]) {
                await emoji.removeEmoji(message);
            } else if (subCmd in ['edit', 'e', 'rename', "rn"]) {
                await emoji.renameEmoji(message);
            }
        } else if (command === "sub") {
            await reddit.sub(message);
        }
    }



    if (message.content.startsWith(`$${reactCmd} <@665224627353681921>`) || message.content.startsWith(`$${reactCmd} <@!665224627353681921>`)) {
        const collection = mongoClient.db("hifumi").collection("mikuReactions");
        const cmdAliases = await collection.findOne({ _id: ObjectId("61ed5a24955085f3e99f7c03") });
        const reactMsgs = await collection.findOne({ _id: ObjectId("61ed5cb4955085f3e99f7c0c") });

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
});

client.on("interactionCreate", async (interaction) => {
    try {
        if (!interaction.isCommand()) return;

        const { commandName } = interaction;

        if (commandName === "avatar") {
            await avatarURL(interaction);
        } else if (commandName === "convert") {
            await convert(interaction);
        } else if (commandName === "emoji") {
            if (interaction.options.getSubcommand() === "add") {
                await emoji.addEmoji(interaction);
            } else if (interaction.options.getSubcommand() === "remove") {
                await emoji.removeEmoji(interaction);
            } else if (interaction.options.getSubcommand() === "rename") {
                await emoji.renameEmoji(interaction);
            }
        } else if (commandName === "imgur") {
            await imgProcess.imgur(interaction);
        } else if (commandName === "urban") {
            await urban(interaction);
        } else if (commandName === "resize") {
            await imgProcess.resizeImg(interaction);
        } else if (commandName === "beautiful") {
            await imgProcess.beautiful(interaction);
        } else if (commandName === "reddit") {
            if (interaction.options.getSubcommand() === "profile") {
                await reddit.profile(interaction);
            } else if (interaction.options.getSubcommand() === "image") {
                await reddit.sub(interaction);
            }
        }
    } catch (error) {
        tools.errorLog(interaction, error);
    }
});


async function jsEval(message) {
    content = message.content.split();
    if (message.author.id === botOwner) {
        if (content.length === 1) {
            return await message.channel.send("You have to type **SOMETHING** at least");
        }
        let cmd = "";
        for (let word of content.slice(1)) {
            cmd += word + " ";
        }
        const rslt = eval(cmd);
        if (rslt === undefined) {
            return await message.channel.send("Cannot send an empty message!");
        }
        if (rslt.length > 2000) {
            return await message.channel.send("The result is too long for discord!");
        }
        await message.channel.send(rslt);

    }
}


async function avatarURL(message) {
    const content = message.content.split();
    let user;

    if (content.length === 1) {
        user = message.author;
    } else if (message.mentions.has) {
        user = message.mentions.users.first();
    } else {
        if (isNaN(content[1])) {
            return await message.channel.send("Invalid ID! Use numbers only please");
        }
        user = await client.fetchUser(content[1]);

    }

    const userID = user.id;
    const userName = user.username;
    const avatarHash = user.avatar;

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

async function convert(message, prefix) {
    const content = message.content.split();
    // const amount = parseFloat(interaction.options.getNumber("amount"));
    // const from = interaction.options.getString("from").toUpperCase();
    // const to = interaction.options.getString("to").toUpperCase();

    if (1 <= content.length <= 3) {
        return await message.channel.send(`Usage: \`${prefix}convert <amount of money> <cur1> <cur2>\``);
    }

    if (!content[2].upper() in currencies && !content[3].upper() in currencies) {
        return await message.channel.send(`Invalid currency codes! Check \`${prefix}currencies\` for a list`);
    }

    const response = await fetch(`https://prime.exchangerate-api.com/v5/${credentials["exchangeApiKey"]}/latest/${from}`);

    if (!response.ok) { return await message.channel.send("Error! Please try again later"); }
    const result = await response.json();

    // Checks for invalid inputs
    if (result["conversion_rates"] === undefined) {
        return await message.channel.send("At least one of your currencies is not supported!");
    } else if (!result["conversion_rates"].hasOwnProperty(to)) {
        return await message.channel.send("Your second currency is not supported!");
    } else if (from === to) {
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
        .setFooter({
            text: `${tools.strftime("%d/%m/%Y %H:%M:%S")}`,
        });

    await message.channel.send({ embeds: [convertEmbed] });
};


async function urban(message) {
    const query = interaction.options.getString("word");

    const response = await fetch(`https://api.urbandictionary.com/v0/define?term=${query}`);

    if (!response.ok) { return await message.channel.send("Error! Please try again later"); }
    const result = response.data;

    if (result["list"] === undefined) {
        return interaction.editReply("No results found!");
    }

    const def = tools.randomElementArray(result["list"]);

    const word = def["word"];
    const definition = def["definition"];
    const example = def["example"];
    const author = def["author"];
    const permalink = def["permalink"];
    const upvotes = def["thumbs_up"];
    const downvotes = def["thumbs_down"];
    const description = `${definition}\n\n**Example:** ${example}\n\n**Author:** ${author}\n\n**Permalink:** [${permalink}](${permalink})`.replace("[", "").replace("]", "");

    const urbanEmbed = new MessageEmbed()
        .setColor(credentials["embedColour"])
        .setTitle(`*${word}*`)
        .setDescription(description)
        .setFooter({
            text: `Upvotes: ${upvotes} Downvotes: ${downvotes}`,
        });

    await message.channel.send({ embeds: [urbanEmbed] });
}

process.on("SIGINT", () => {
    mongoClient.close(() => {
        console.log("Disconnected the database");
        process.exit(0);
    });
});

client.login(credentials["token"]);
