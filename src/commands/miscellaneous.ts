import { exec } from "child_process";
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    CommandInteraction,
    EmbedBuilder,
    Message,
    PermissionFlagsBits,
    ThreadAutoArchiveDuration,
} from "discord.js";
import { evaluate as mathEvaluate } from "mathjs";
import fetch from "node-fetch";
import strftime from "strftime";
import { promisify } from "util";
import { client, db, prefixMap } from "../app.js";
import { EMBED_COLOUR, EXCHANGE_API_KEY } from "../config.js";
import {
    ConvertResponse,
    ConvertResponseSchema,
    EmbedMetadata,
    UrbanEntry,
    UrbanResponse,
    UrbanResponseSchema,
} from "../helpers/types.js";
import {
    getUserObjectPingId,
    hasPermission,
    isBotOwner,
    randomElementFromArray,
    sendOrReply,
    setEmbedArr,
    sleep,
    writeUpdateFile,
} from "../helpers/utils.js";
import {
    currencies as currenciesTable,
    helpMessages,
    leet as leetTable,
    mikuCommandAliases,
    mikuReactions,
} from "./../db/schema.js";

export const execPromise = promisify(exec);
export const urbanEmbeds: EmbedMetadata[] = [];

export async function checkForImgAndCreateThread(message: Message) {
    if (!["1059119862741471253", "1059120608593584258"].includes(message.channel.id)) {
        return;
    }

    if (
        !hasPermission(PermissionFlagsBits.ManageMessages, message) &&
        message.attachments.size === 0
    ) {
        return await message.delete();
    }

    if (message.attachments.size === 0) return;

    return await message.startThread({
        name: message.author.username,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
        reason: "Image thread",
    });
}

export async function pingRandomMembers(message: Message) {
    if (message.guild === null) return;

    if (
        !isBotOwner(message.author) &&
        !hasPermission(PermissionFlagsBits.MentionEveryone, message)
    ) {
        return;
    }

    const amountInput = +message.content.split(" ")[1];
    const amount = isNaN(amountInput) ? 1 : amountInput;

    const members = await message.guild.members.fetch();

    // >= 2 because the @everyone role is always present
    const randomMembers = members
        .filter((member) => !member.user.bot && member.roles.cache.size >= 2)
        .random(amount);

    if (randomMembers.length === 0) {
        return await message.channel.send("Couldn't find a user to ping");
    }

    let outputString = randomMembers.map((member) => member.toString()).join(" ");

    if (outputString.length > 2000) {
        outputString = outputString.substring(0, 2000).split(" ").slice(0, -1).join(" ");
    }

    return await message.channel.send(outputString);
}

export async function reactToMiku(message: Message, reactCmd: string): Promise<void | Message> {
    const reactMsgs = await db.select().from(mikuReactions).execute();
    const cmdAliases = await db.select().from(mikuCommandAliases).execute();

    for (const item of cmdAliases) {
        if (item.alias === reactCmd) {
            const msg = randomElementFromArray(
                reactMsgs.filter((x) => x.command === item.command).map((x) => x.reaction)
            ).replace("{0}", message.member?.displayName ?? message.author.username);
            await sleep(1000);
            return await message.channel.send(msg);
        }
    }
}

export async function leet(message: Message): Promise<void | Message> {
    const inputWords = message.content.split(" ").slice(1);
    const leetDoc = await db.select().from(leetTable).execute();

    const document = {} as Record<string, string[]>;

    for (const char of leetDoc) {
        if (!(char.source in document)) document[char.source] = [];
        document[char.source].push(char.translated);
    }

    const leetOutput = inputWords
        .map((word) => {
            return word
                .split("")
                .map((char) => {
                    if (char in document) return randomElementFromArray(document[char]);
                    return char;
                })
                .join("");
        })
        .join(" ");

    await message.channel.send(leetOutput.substring(0, 2000));
}

export async function helpCmd(message: Message | CommandInteraction, prefix?: string) {
    const helpMsgArray = await db.select().from(helpMessages).execute();

    if (helpMsgArray.length === 0) {
        return sendOrReply(message, "Seems there aren't any help messages saved in the database");
    }

    if (!prefix) prefix = prefixMap.get(message.guildId ?? "") ?? "h!";

    const helpMsg = helpMsgArray
        .map((helpMsgObj) => `**${prefix}${helpMsgObj.cmd}** - ${helpMsgObj.desc}`)
        .join("\n");

    const helpEmbed = new EmbedBuilder()
        .setColor(EMBED_COLOUR)
        .setTitle("**Hifumi's commands**")
        .setDescription(helpMsg);

    return await sendOrReply(message, { embeds: [helpEmbed] });
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
    writeUpdateFile();
    exec("pnpm run restart");
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
    const content = message.content.split(" ");

    const user = content.length === 1 ? message.author : await getUserObjectPingId(message);

    if (!user) return await message.channel.send("Couldn't find the specified User");

    const avatarURL = user.displayAvatarURL({ forceStatic: false, size: 4096 });

    if (!avatarURL) return await message.channel.send("No avatar found!");

    const avatarEmbed = new EmbedBuilder()
        .setColor(EMBED_COLOUR)
        .setTitle(`*${user.username}'s Avatar*`)
        .setImage(avatarURL);

    return await message.channel.send({ embeds: [avatarEmbed] });
}

export async function listCurrencies(message: Message) {
    const table = await db.select().from(currenciesTable).execute();

    const currencies = table.reduce((acc, curr) => {
        acc[curr.code] = curr.longName;
        return acc;
    }, {} as Record<string, string>);

    const title = "List of currencies available for conversion";
    const columns = ["", "", ""];
    const currencyKeys = Object.keys(currencies).sort();

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

    const table = await db.select().from(currenciesTable).execute();

    const currencies = table.reduce((acc, curr) => {
        acc[curr.code] = curr.longName;
        return acc;
    }, {} as Record<string, string>);

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
    client.destroy();
    exec("pm2 delete hifumi");
}
