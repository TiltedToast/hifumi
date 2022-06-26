import * as emoji from "./commands/emoji.js";
import * as database from "./commands/database.js";
import * as imgProcess from "./commands/imgProcess.js";
import * as reddit from "./commands/reddit.js";
import strftime from "strftime";
import fetch from "node-fetch";
import { Interaction, Message, MessageActionRow, MessageButton, MessageEmbed, User, Util } from "discord.js";
import { client, mongoClient, prefixDict } from "./app.js";
import { randomElementArray, sleep, errorLog, getUserObjectPingId, isDev, getEmbedIndex } from "./commands/tools.js";
import { exec } from "child_process";
import { EMBED_COLOUR, BOT_OWNER, EXCHANGE_API_KEY } from "./config.js";
import type { ConvertResponse } from "./interfaces/ConvertResponse.js";
import type { UrbanResponse, UrbanEntry } from "./interfaces/UrbanResponse";
import type { EmbedMetadata, UpdateEmbedOptions } from "./interfaces/UpdateEmbedOptions.js";
import { promisify } from "util";
const execPromise = promisify(exec);

let urbanEmbeds: EmbedMetadata[] = [];

export async function handleMessage(message: Message) {
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
        const reactCmd = content[0].slice(1) ?? "";
        const subCmd = content[1] ?? "";

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
            else if (command === "pull") await gitPull(message);
        }

        // Reacting to Miku's emote commands
        // Grabs a random reply from the db and sents it as a message after a fixed delay
        const botId = isDev() ? "665224627353681921" : "641409330888835083";

        if (isMikuTrigger(message, reactCmd, botId)) {
            await reactToMiku(message, reactCmd);
        }
    } catch (err: unknown) {
        errorLog(message, err as Error);
    }
}

export async function handleInteraction(interaction: Interaction) {
    if (interaction.guild?.me === null) return;

    if (interaction.isButton()) {
        if (["prevUrban", "nextUrban"].includes(interaction.customId)) {
            await updateEmbed({
                interaction,
                embedArray: urbanEmbeds,
                prevButtonId: "prevUrban",
                nextButtonId: "nextUrban",
                user: interaction.user,
            });
        }
    }
}

async function updateEmbed({ interaction, embedArray, prevButtonId, nextButtonId, user }: UpdateEmbedOptions) {
    const activeIndex = getEmbedIndex(embedArray, {
        embed: interaction.message.embeds[0],
        user,
    });

    if (interaction.user !== embedArray[activeIndex].user) {
        return interaction.reply({
            content: "Run the command yourself to be able to cycle through the results",
            ephemeral: true,
        });
    }
    if (activeIndex === 0 && interaction.customId === prevButtonId) {
        await interaction.update({ embeds: [embedArray[embedArray.length - 1].embed] });
    } else if (activeIndex === embedArray.length - 1 && interaction.customId === nextButtonId) {
        await interaction.update({ embeds: [embedArray[0].embed] });
    } else {
        await interaction.update({
            embeds: [embedArray[activeIndex + (interaction.customId === prevButtonId ? -1 : 1)].embed],
        });
    }
}

async function reactToMiku(message: Message, reactCmd: string): Promise<void | Message> {
    const mikuReactions = await mongoClient.db("hifumi").collection("mikuReactions").find().toArray();

    if (mikuReactions.length !== 2) {
        return await message.channel.send("No Miku reactions found in the database");
    }

    const [cmdAliases, reactMsgs] = mikuReactions;

    for (const alias in cmdAliases) {
        if (Object.values(cmdAliases[alias]).includes(reactCmd)) {
            const msg = (randomElementArray(reactMsgs[alias]) as string).replace("{0}", message.author.username);
            await sleep(1000);
            return await message.channel.send(msg);
        }
    }
}

function isMikuTrigger(message: Message, reactCmd: string, botId: string): boolean {
    if (message.content.startsWith(`$${reactCmd}`) && message.type === "REPLY") {
        const repliedMsg = message.channel.messages.resolve(message.reference?.messageId ?? "");
        if (!repliedMsg) return false;
        if (repliedMsg.author.id === botId) return true;
    }

    return (
        message.content.startsWith(`$${reactCmd} <@${botId}>`) ||
        message.content.startsWith(`$${reactCmd} <@!${botId}>`)
    );
}

async function leet(message: Message): Promise<void | Message<boolean>> {
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

    const helpMsg = helpMsgArray
        .map((helpMsgObj) => `**${prefix}${helpMsgObj["cmd"]}** - ${helpMsgObj["desc"]}`)
        .join("\n");

    const helpEmbed = new MessageEmbed()
        .setColor(EMBED_COLOUR)
        .setTitle("**Hifumi's commands**")
        .setDescription(helpMsg);

    return await message.channel.send({ embeds: [helpEmbed] });
}

async function gitPull(message: Message) {
    if (message.author.id !== BOT_OWNER) return;
    await consoleCmd(message, "git pull");
    await reloadBot(message);
}

async function consoleCmd(message: Message, cmd?: string) {
    if (message.author.id !== BOT_OWNER) return;
    // Creates a new string with the message content without the command
    // And runs it in a new shell process
    const command = cmd ? cmd : message.content.split(" ").slice(1).join(" ");
    try {
        const { stdout, stderr } = await execPromise(command);
        if (stderr) await message.channel.send(`\`\`\`${stderr}\`\`\``);

        const msg = stdout ? `\`\`\`${stdout}\`\`\`` : "Command executed!";

        if (msg.length > 2000) return await message.channel.send("Command output too long!");
        return await message.channel.send(msg);
    } catch (error) {
        return await message.channel.send(`\`\`\`${error}\`\`\``);
    }
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

    return await message.channel.send({ embeds: [avatarEmbed] });
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

    return await message.channel.send({ embeds: [currEmbed] });
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
    // Checks for possible pointless conversions
    if (from === to) return await message.channel.send("Your first currency is the same as your second currency!");
    if (amount < 0) return await message.channel.send("You can't convert a negative amount!");
    if (amount === 0) return await message.channel.send("Zero will obviously stay 0!");

    const response = await fetch(`https://prime.exchangerate-api.com/v5/${EXCHANGE_API_KEY}/latest/${from}`);
    if (!response.ok) return await message.channel.send("Error! Please try again later");
    const result = (await response.json()) as ConvertResponse;

    const convertEmbed = buildConvertEmbed(result, to, amount, from);

    return await message.channel.send({ embeds: [convertEmbed] });
}

function buildConvertEmbed(result: ConvertResponse, to: string, amount: number, from: string) {
    const rate = result["conversion_rates"][to];
    const rslt = Math.round(amount * rate * 100) / 100;
    const description = `**${Number(amount)} ${from} ≈ ${Number(
        rslt
    )} ${to}**\n\nExchange Rate: 1 ${from} ≈ ${rate} ${to}`;

    return new MessageEmbed()
        .setColor(EMBED_COLOUR)
        .setTitle(`Converting ${from} to ${to}`)
        .setDescription(description)
        .setFooter({ text: `${strftime("%d/%m/%Y %H:%M:%S")}` });
}

async function urban(message: Message, prefix: string): Promise<Message> {
    const content = message.content.split(" ");

    if (content.length !== 2) return await message.channel.send(`Usage: \`${prefix}urban <word>\``);

    const query = content[1];
    const response = await fetch(`https://api.urbandictionary.com/v0/define?term=${query}`);
    if (!response.ok) return await message.channel.send(`Error ${response.status}! Please try again later`);

    const result = ((await response.json()) as UrbanResponse)["list"];

    if (result.length === 0) return message.channel.send("No results found!");

    await updateUrbanEmbeds(result, message.author);
    const row = new MessageActionRow().addComponents(
        new MessageButton().setCustomId("prevUrban").setLabel("PREV").setStyle("PRIMARY"),
        new MessageButton().setCustomId("nextUrban").setLabel("NEXT").setStyle("PRIMARY")
    );

    return await message.channel.send({ embeds: [urbanEmbeds[0].embed], components: [row] });
}

async function updateUrbanEmbeds(result: UrbanEntry[], user: User) {
    result.sort((a, b) => (b.thumbs_up > a.thumbs_up ? 1 : -1));
    urbanEmbeds = [];
    for (let i = 0; i < result.length; i++) {
        urbanEmbeds.push({
            embed: buildUrbanEmbed(result[i], i, result),
            user: user,
        });
    }
}

function buildUrbanEmbed(resultEntry: UrbanEntry, index: number, array: UrbanEntry[]) {
    const { word, definition, example, author, permalink, thumbs_up, thumbs_down } = resultEntry;

    const footerPagination = `${index + 1}/${array.length}`;

    const description = `${definition}\n
        **Example:** ${example}\n
        **Author:** ${author}\n
        **Permalink:** ${permalink}`.replace(/\]|\[/g, "");

    return new MessageEmbed()
        .setColor(EMBED_COLOUR)
        .setTitle(`*${word}*`)
        .setDescription(description)
        .setFooter({ text: `Upvotes: ${thumbs_up} Downvotes: ${thumbs_down}\n${footerPagination}` });
}

async function bye(message: Message): Promise<Message | void> {
    if (message.author.id !== BOT_OWNER) return;

    // Closes the MongoDB connection and stops the running daemon via pm2
    await message.channel.send("Bai baaaaaaaai!!");
    await mongoClient.close();
    client.destroy();
    exec("pm2 delete hifumi");
}
