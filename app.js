import * as tools from "./tools.js";
import * as emoji from "./emoji.js";
import * as imgProcess from "./imgProcess.js";
import * as reddit from "./reddit.js";
import { credentials } from "./config.js";
import { Client, Intents, MessageEmbed } from "discord.js";
import { MongoClient, ObjectId } from "mongodb";
import axios from 'axios';

const allIntents = new Intents(32767);
export const client = new Client({ intents: allIntents });
export const mongoClient = new MongoClient(credentials["mongoURI"]);
const startTime = Date.now();

client.once("ready", async () => {
    const time = tools.strftime("%d/%m/%Y %H:%M:%S");
    const doneLoadingTime = Date.now();

    console.log(
        `Started up in ${(doneLoadingTime - startTime) /
        1000} seconds on ${time}`
    );
    console.log("Logged in as:");
    console.log(client.user.username);
    console.log(client.user.id);
    console.log("------");

    mongoClient.connect();
    console.log("Connected to the database");

    // await tools.setRandomStatus(client);

    // const channel = client.channels.cache.get('655484804405657642');
    // channel.send(`Logged in as:\n${client.user.username}\nTime: ${time}\n--------------------------`);
    client.user.setActivity("with best girl Annie!", { type: "PLAYING" });
});


client.on("messageCreate", async (message) => {
    const content = message.content.split(" ");
    let reactCmd;
    if (content.length > 1) {
        reactCmd = content[0].slice(1);
    }

    if (
        message.content.startsWith(`$${reactCmd} <@665224627353681921>`) ||
        message.content.startsWith(`$${reactCmd} <@!665224627353681921>`)
    ) {
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
    if (message.content === 'h?ping') {
        message.channel.send(`API Latency is ${Math.round(client.ws.ping)}ms`);
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

async function avatarURL(interaction) {
    await interaction.deferReply();
    const optionsArray = tools.getOptionsArray(interaction.options.data);
    const user = tools.getUserFromUserAndId(
        client,
        interaction,
        optionsArray,
        "user",
        "userid"
    );

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

    interaction.editReply({ embeds: [avatarEmbed] });
}

async function convert(interaction) {
    const amount = parseFloat(interaction.options.getNumber("amount"));
    const from = interaction.options.getString("from").toUpperCase();
    const to = interaction.options.getString("to").toUpperCase();

    const response = await axios.get(`https://prime.exchangerate-api.com/v5/${credentials["exchangeApiKey"]}/latest/${from}`);
    const result = response.data

    // Checks for invalid inputs
    if (result["conversion_rates"] === undefined) {
        return interaction.reply("At least one of your currencies is not supported!");
    } else if (!result["conversion_rates"].hasOwnProperty(to)) {
        return interaction.reply("Your second currency is not supported!");
    } else if (from === to) {
        return interaction.reply("Your first currency is the same as your second currency!");
    } else if (amount < 0) {
        return interaction.reply("You can't convert a negative amount!");
    } else if (amount === 0) {
        return interaction.reply("Zero will obviously stay 0!");
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

    interaction.reply({ embeds: [convertEmbed] });
};


async function urban(interaction) {
    const query = interaction.options.getString("word");
    const url = `https://api.urbandictionary.com/v0/define?term=${query}`;

    const response = await axios.get(url);
    const result = response.data;

    if (result["list"] === undefined) {
        return interaction.reply("No results found!");
    }

    const def = tools.randomElementArray(result["list"]);

    if (def === undefined) {
        return interaction.reply("No results found!");
    }

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

    interaction.reply({ embeds: [urbanEmbed] });
}

process.on("SIGINT", function () {
    mongoClient.close(function () {
        console.log("Disconnected the database");
        process.exit(0);
    });
});

client.login(credentials["token"]);
