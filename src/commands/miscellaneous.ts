import { exec } from "child_process";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Message } from "discord.js";
import { evaluate as mathEvaluate } from "mathjs";
import fetch from "node-fetch";
import strftime from "strftime";
import { promisify } from "util";
import { client, mongoClient } from "../app.js";
import { EMBED_COLOUR, EXCHANGE_API_KEY } from "../config.js";
import {
    ConvertResponse,
    ConvertResponseSchema,
    EmbedMetadata,
    MikuEmoteReactionItems,
    MikuEmoteReactionItemsSchema,
    UrbanEntry,
    UrbanResponse,
    UrbanResponseSchema,
} from "../helpers/types.js";
import {
    getUserObjectPingId,
    isBotOwner,
    randomElementFromArray,
    setEmbedArr,
    sleep,
    writeUpdateFile,
} from "../helpers/utils.js";

export const execPromise = promisify(exec);
export const urbanEmbeds: EmbedMetadata[] = [];

export async function reactToMiku(message: Message, reactCmd: string): Promise<void | Message> {
    const mikuReactions = (await mongoClient
        .db("hifumi")
        .collection("mikuReactions")
        .find({}, { projection: { _id: 0 } })
        .toArray()) as unknown as MikuEmoteReactionItems;

    if (!MikuEmoteReactionItemsSchema.safeParse(mikuReactions).success) {
        console.log("Couldn't parse reactions for miku's emotes from db");
        return;
    }

    const [cmdAliases, reactMsgs] = mikuReactions;

    for (const alias in cmdAliases) {
        if (Object.values(cmdAliases[alias]).includes(reactCmd)) {
            const msg = randomElementFromArray(reactMsgs[alias]).replace(
                "{0}",
                message.author.username
            );
            await sleep(1000);
            return await message.channel.send(msg);
        }
    }
}

export async function leet(message: Message): Promise<void | Message> {
    const inputWords = message.content.split(" ").slice(1);
    const leetDoc = (await mongoClient.db("hifumi").collection("leet").find().toArray())[0];

    if (leetDoc === null)
        return message.channel.send("Couldn't find the necessary entries in the database");

    const leetOutput = inputWords
        .map((word) => {
            return word
                .split("")
                .map((char) => {
                    if (char in leetDoc) return randomElementFromArray(leetDoc[char]);
                    return char;
                })
                .join("");
        })
        .join(" ");

    await message.channel.send(leetOutput.substring(0, 2000));
}

export async function helpCmd(message: Message, prefix: string) {
    const helpMsgArray = await mongoClient
        .db("hifumi")
        .collection("helpMsgs")
        .find()
        .sort({ cmd: 1 })
        .toArray();
    if (helpMsgArray.length === 0)
        return await message.channel.send(
            "Seems there aren't any help messages saved in the database"
        );

    const helpMsg = helpMsgArray
        .map((helpMsgObj) => `**${prefix}${helpMsgObj["cmd"]}** - ${helpMsgObj["desc"]}`)
        .join("\n");

    const helpEmbed = new EmbedBuilder()
        .setColor(EMBED_COLOUR)
        .setTitle("**Hifumi's commands**")
        .setDescription(helpMsg);

    return await message.channel.send({ embeds: [helpEmbed] });
}

export async function gitPull(message: Message) {
    if (!isBotOwner(message.author)) return;
    await consoleCmd(message, "git pull");
    await reloadBot(message);
}

export async function consoleCmd(message: Message, cmd?: string, python = false) {
    if (!isBotOwner(message.author)) return;
    // Creates a new string with the message content without the command
    // And runs it in a new shell process

    const input = message.content.split(" ").slice(1).join(" ");
    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    const command = cmd ? cmd : python ? `${pythonCmd} -c "print(${input})"` : input;
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
    if (!isBotOwner(message.author)) return;
    await mongoClient.close();
    writeUpdateFile();
    exec("npm run restart");
    await message.channel.send("Reload successful!");
}

export async function jsEval(message: Message, mode?: "math") {
    if (!isBotOwner(message.author)) return;
    let rslt: string;

    // This is to be able to use all the functions inside the below eval function
    // Sleep call mostly to shut up typescript and eslint
    const tools = await import("../helpers/utils.js");
    await tools.sleep(1);

    const content = message.content.split(" ");

    if (content.length === 1)
        return await message.channel.send("You have to type **SOMETHING** at least");

    const command = message.content.split(" ").slice(1).join(" ");
    try {
        if (mode === "math") rslt = mathEvaluate(command);
        else rslt = await eval(command);
    } catch (error) {
        return await message.channel.send(`\`\`\`${error}\`\`\``);
    }

    if (typeof rslt === "object") rslt = `\`\`\`js\n${JSON.stringify(rslt, null, 4)}\n\`\`\``;
    if (rslt == null) return await message.channel.send("Cannot send an empty message!");

    const resultString = rslt.toString();

    if (!resultString || resultString.length > 2000)
        return await message.channel.send("Invalid message length for discord!");
    return await message.channel.send(resultString);
}

export async function avatar(message: Message) {
    let url: string;
    const content = message.content.split(" ");

    const user = content.length === 1 ? message.author : await getUserObjectPingId(message);

    if (!user) return await message.channel.send("Couldn't find the specified User");

    const { id: userId, username, avatar: avatarHash } = user;

    const avatarURL = user.displayAvatarURL({ forceStatic: false });

    if (!avatarURL) return await message.channel.send("No avatar found!");

    if (avatarURL.includes(".gif")) {
        url = `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.gif?size=4096`;
    } else {
        url = `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=4096`;
    }

    const avatarEmbed = new EmbedBuilder()
        .setColor(EMBED_COLOUR)
        .setTitle(`*${username}'s Avatar*`)
        .setImage(url);

    return await message.channel.send({ embeds: [avatarEmbed] });
}

export async function listCurrencies(message: Message) {
    const currencies = (
        await mongoClient.db("hifumi").collection("currencies").find().toArray()
    )[0];

    if (currencies === null)
        return await message.channel.send("Couldn't find any currencies in the database");

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

    const currEmbed = new EmbedBuilder().setColor(EMBED_COLOUR).setTitle(title);
    currEmbed.addFields(
        columns.map((column) => ({
            name: "\u200b",
            value: column,
            inline: true,
        }))
    );

    return await message.channel.send({ embeds: [currEmbed] });
}

export async function convert(message: Message, prefix: string) {
    const content = message.content.split(" ");

    if (content.length !== 4)
        return await message.channel.send(
            `Usage: \`${prefix}convert <amount of money> <cur1> <cur2>\``
        );

    const currencies = (
        await mongoClient.db("hifumi").collection("currencies").find().toArray()
    )[0];

    if (currencies === null)
        return await message.channel.send("Couldn't find any currencies in the database");

    const amount = parseFloat(content[1]);
    const from = content[2].toUpperCase();
    const to = content[3].toUpperCase();

    if (!(from in currencies) || !(to in currencies)) {
        return await message.channel.send(
            `Invalid currency codes! Check \`${prefix}currencies\` for a list`
        );
    }
    // Checks for possible pointless conversions
    if (from === to)
        return await message.channel.send(
            "Your first currency is the same as your second currency!"
        );
    if (amount < 0) return await message.channel.send("You can't convert a negative amount!");
    if (amount === 0) return await message.channel.send("Zero will obviously stay 0!");

    const response = await fetch(
        `https://prime.exchangerate-api.com/v5/${EXCHANGE_API_KEY}/latest/${from}`
    );

    const result = (await response.json()) as ConvertResponse;

    if (!ConvertResponseSchema.safeParse(result).success) {
        return await message.channel.send(
            "Something went wrong with the API, maybe try again later"
        );
    }

    if (result.result === "error")
        return await message.channel.send(`Error: ${result["error-type"]}`);
    if (!response.ok) return await message.channel.send("Error! Please try again later");

    const convertEmbed = buildConvertEmbed(result, to, amount, from);

    return await message.channel.send({ embeds: [convertEmbed] });
}

function buildConvertEmbed(result: ConvertResponse, to: string, amount: number, from: string) {
    const rate = result["conversion_rates"] ? result["conversion_rates"][to] : 0;
    const rslt = Math.round(amount * rate * 100) / 100;
    const description = `**${Number(amount)} ${from} ≈ ${Number(
        rslt
    )} ${to}**\n\nExchange Rate: 1 ${from} ≈ ${rate} ${to}`;

    return new EmbedBuilder()
        .setColor(EMBED_COLOUR)
        .setTitle(`Converting ${from} to ${to}`)
        .setDescription(description)
        .setFooter({ text: `${strftime("%d/%m/%Y %H:%M:%S")}` });
}

export async function urban(message: Message, prefix: string) {
    const content = message.content.split(" ").slice(1);

    if (!content.length) return await message.channel.send(`Usage: \`${prefix}urban <word>\``);

    const query = content.join("");

    const response = await fetch(`https://api.urbandictionary.com/v0/define?term=${query}`);
    if (!response.ok)
        return await message.channel.send(`Error ${response.status}! Please try again later`);

    const result = (await response.json()) as UrbanResponse;

    if (!UrbanResponseSchema.safeParse(result).success) {
        return await message.channel.send(
            "Something went wrong with the API, maybe try again later"
        );
    }

    if (result.list.length === 0) return message.channel.send("No results found!");

    await setEmbedArr({
        result: result.list,
        userID: message.author.id,
        sortKey: "thumbs_up",
        embedArray: urbanEmbeds,
        buildEmbedFunc: buildUrbanEmbed,
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("prevUrban").setLabel("PREV").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("nextUrban").setLabel("NEXT").setStyle(ButtonStyle.Primary)
    );

    return await message.channel.send({
        embeds: [urbanEmbeds[0].embed],
        components: [row],
    });
}

function buildUrbanEmbed(resultEntry: UrbanEntry, index: number, array: UrbanEntry[]) {
    const { word, definition, example, author, permalink, thumbs_up, thumbs_down } = resultEntry;

    const footerPagination = `${index + 1}/${array.length}`;

    const description =
        `${definition}\n\n**Example:** ${example}\n\n**Author:** ${author}\n\n**Permalink:** ${permalink}
    `.replace(/\]|\[/g, "");

    return new EmbedBuilder()
        .setColor(EMBED_COLOUR)
        .setTitle(`*${word}*`)
        .setDescription(description)
        .setFooter({
            text: `Upvotes: ${thumbs_up} Downvotes: ${thumbs_down}\n${footerPagination}`,
        });
}

export async function bye(message: Message) {
    if (!isBotOwner(message.author)) return;

    // Closes the MongoDB connection and stops the running daemon via pm2
    await message.channel.send("Bai baaaaaaaai!!");
    await mongoClient.close();
    client.destroy();
    exec("pm2 delete hifumi");
}
