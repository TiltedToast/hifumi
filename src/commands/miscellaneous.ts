import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    CommandInteraction,
    EmbedBuilder,
    Message,
    PermissionFlagsBits,
    ThreadAutoArchiveDuration,
    codeBlock,
} from "discord.js";
import { evaluate as mathEvaluate } from "mathjs";
import fetch from "node-fetch";
import { exec } from "node:child_process";
import { writeFileSync } from "node:fs";
import { promisify } from "node:util";
import { client, prefixMap } from "../app.js";
import { EMBED_COLOUR } from "../config.js";
import { db } from "../db/index.js";
import {
    EmbedMetadata,
    PairConversionResponse,
    PairConversionResponseSchema,
    SupportedCodesResponse,
    SupportedCodesSchema,
    UrbanEntry,
    UrbanResponse,
    UrbanResponseSchema,
} from "../helpers/types.js";
import {
    createTemp,
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
    helpMessages,
    leet as leetTable,
    mikuCommandAliases,
    mikuReactions,
} from "./../db/schema.js";

export const execPromise = promisify(exec);
export const urbanEmbeds: EmbedMetadata[] = [];

export async function wolframALpha(message: Message) {
    if (!isBotOwner(message.author)) return;
    const query = message.content.split(" ").slice(1).join(" ");

    createTemp();

    if (!query) return await message.channel.send("No query provided!");

    const url =
        `http://api.wolframalpha.com/v2/simple?appid=` +
        process.env.WOLFRAM_ALPHA_APP_ID +
        `&i=${encodeURIComponent(query)}` +
        `&background=181A1F&foreground=white` +
        "&fontsize=30&units=metric&width500";

    const response = await fetch(url);

    if (!response.ok) {
        const error = await response.text();
        return await message.channel.send(`Something went wrong! ${error}`);
    }

    const buffer = await response.arrayBuffer();

    writeFileSync("./temp/wolfram.png", Buffer.from(buffer));

    return await message.channel.send({ files: ["./temp/wolfram.png"] });
}

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

export async function reactToMiku(message: Message, reactCmd: string) {
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

export async function leet(message: Message) {
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
        return await sendOrReply(
            message,
            "Seems there aren't any help messages saved in the database"
        );
    }

    if (!prefix) prefix = prefixMap.get(message.guildId ?? "") ?? "h!";

    const helpMsg = helpMsgArray
        .map((helpMsgObj) => `**${prefix ?? "h!"}${helpMsgObj.cmd}** - ${helpMsgObj.desc}`)
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
        if (stderr) await message.channel.send(codeBlock(stderr));

        const msg = stdout ? codeBlock(stdout) : "Command executed!";

        if (msg.length > 2000) return await message.channel.send("Command output too long!");
        return await message.channel.send(msg);
    } catch (error) {
        return await message.channel.send(codeBlock(error as string));
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
        if (mode === "math") rslt = mathEvaluate(command) as string;
        else rslt = (await eval(command)) as string;
    } catch (error) {
        return await message.channel.send(codeBlock(error as string));
    }

    if (typeof rslt === "object") rslt = codeBlock("js", JSON.stringify(rslt, null, 4));
    if (!rslt) return await message.channel.send("Cannot send an empty message!");

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

export async function convert(message: Message, prefix: string) {
    const content = message.content.split(" ");

    if (content.length < 3)
        return await message.channel.send(
            `Usage: \`${prefix}convert <amount of money> <cur1> <cur2>\``
        );

    const currencies = {} as Record<string, string>;

    let amount: number;
    let base_currency: string;
    let target_currency: string;

    if (content.length === 3) {
        amount = 1;
        base_currency = content[1].toUpperCase();
        target_currency = content[2].toUpperCase();
    } else {
        amount = parseFloat(content[1]);
        base_currency = content[2].toUpperCase();
        target_currency = content[3].toUpperCase();
    }

    amount = isNaN(amount) ? 1 : amount;

    const codesResp = await fetch(
        `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_API_KEY}/codes`
    );
    const supportedResult = (await codesResp.json()) as SupportedCodesResponse;

    if (!SupportedCodesSchema.safeParse(supportedResult).success) {
        return await message.channel.send(
            "Something went wrong while fetching the supported currencies! Please try again later"
        );
    }

    if (supportedResult.result === "error") {
        let msg = "Something went wrong fetching the supported currencies! Please try again later";
        switch (supportedResult["error-type"]) {
            case "invalid-key":
                msg = "Invalid API key. This should never happen, please contact the Bot Owner!";
                break;
            case "quota-reached":
                msg = "API quota reached. Please try again later!";
                break;
            case "inactive-account":
                msg = "API account is inactive. Please contact the bot owner!";
                break;
        }
        return await message.channel.send(msg);
    }

    for (const [code, name] of supportedResult.supported_codes) {
        currencies[code] = name;
    }

    if (!(base_currency in currencies) || !(target_currency in currencies)) {
        return await message.channel.send(
            `Invalid currency codes!\nCheck ` +
                `<https://www.exchangerate-api.com/docs/supported-currencies> ` +
                `for a list of supported currencies`
        );
    }
    // Checks for possible pointless conversions
    if (base_currency === target_currency)
        return await message.channel.send(
            "Your first currency is the same as your second currency!"
        );
    if (amount < 0) return await message.channel.send("You can't convert a negative amount!");
    if (amount === 0) return await message.channel.send("Zero will obviously stay 0!");

    const response = await fetch(
        `https://v6.exchangerate-api.com/v6/` +
            `${process.env.EXCHANGE_API_KEY}/pair/${base_currency}/${target_currency}/${amount}`
    );

    const result = (await response.json()) as PairConversionResponse;

    if (!PairConversionResponseSchema.safeParse(result).success) {
        return await message.channel.send(
            "Something went wrong with the API, maybe try again later"
        );
    }

    if (result.result === "error") {
        let msg = "Something went wrong with the API, maybe try again later";
        switch (result["error-type"]) {
            case "unsupported-code":
                msg = "One of the currencies you entered is not supported!";
                break;
            case "malformed-request":
                msg = "The request was malformed, please try again later!";
                break;
            case "invalid-key":
                msg = "Invalid API key. This should never happen, please contact the Bot Owner!";
                break;
            case "quota-reached":
                msg = "API quota reached. Please try again later!";
                break;
            case "inactive-account":
                msg = "API account is inactive. Please contact the bot owner!";
                break;
        }
        return await message.channel.send(msg);
    }
    if (!response.ok) return await message.channel.send("Error! Please try again later");

    const description = [
        `**${amount} ${currencies[base_currency]} ≈ `,
        `${result.conversion_result ?? 0} ${currencies[target_currency]}**`,
        `\n\nExchange Rate: 1 ${base_currency} ≈ ${result.conversion_rate ?? 0} ${target_currency}`,
    ].join("");

    const lastUpdated = new Date(
        Date.parse(result.time_last_update_utc ?? Date.now().toString())
    ).toUTCString();

    const convertEmbed = new EmbedBuilder()
        .setColor(EMBED_COLOUR)
        .setTitle(`Converting ${base_currency} to ${target_currency}`)
        .setDescription(description)
        .setFooter({ text: `Last updated: ${lastUpdated}` });

    return await message.channel.send({ embeds: [convertEmbed] });
}

export async function urban(message: Message, prefix: string) {
    const query = message.content.split(" ").slice(1).join(" ");

    if (!query.length) return await message.channel.send(`Usage: \`${prefix}urban <query>\``);

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

    setEmbedArr({
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
