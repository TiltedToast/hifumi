import dedent from "dedent";
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    EmbedBuilder,
    Message,
    PermissionFlagsBits,
    ThreadAutoArchiveDuration,
    User,
    codeBlock,
} from "discord.js";
import { all, create } from "mathjs";
import assert from "node:assert/strict";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import {
    BOT_NAME,
    DEFAULT_PREFIX,
    DEV_PREFIX,
    EMBED_COLOUR,
    IMAGE_THREAD_CHANNELS,
    OWNER_NAME,
} from "../config.ts";
import { db } from "../db/index.ts";
import {
    helpMessages,
    leet as leetTable,
    mikuCommandAliases,
    mikuReactions,
} from "../db/schema.ts";
import { prefixMap } from "../handlers/prefixes.ts";
import {
    PairConversionResponseSchema,
    SupportedCodesSchema,
    UrbanResponseSchema,
    type EmbedData,
    type PairConversionResponse,
    type SupportedCodesResponse,
    type UrbanEntry,
    type UrbanResponse,
} from "../helpers/types.ts";
import {
    getUserObjectPingId,
    hasPermission,
    isBotOwner,
    isChatInputCommandInteraction,
    isDev,
    randomElementFromArray,
    sendOrReply,
    setEmbedArr,
    writeUpdateFile,
} from "../helpers/utils.ts";

const { WOLFRAM_ALPHA_APP_ID, EXCHANGE_API_KEY } = process.env;

export const execPromise = promisify(exec);
export const urbanEmbeds: Record<`${string}-${string}`, EmbedData[]> = {};
const math = create(all);

// eslint-disable-next-line @typescript-eslint/unbound-method
const mathEvaluate = math.evaluate;

/**
 * Disables all the functions that could be used to do malicious stuff
 */
math.import(
    {
        import: () => {
            throw new Error("Function import is disabled");
        },
        createUnit: () => {
            throw new Error("Function createUnit is disabled");
        },
        evaluate: () => {
            throw new Error("Function evaluate is disabled");
        },
        parse: () => {
            throw new Error("Function parse is disabled");
        },
        simplify: () => {
            throw new Error("Function simplify is disabled");
        },
        derivative: () => {
            throw new Error("Function derivative is disabled");
        },
    },
    { override: true }
);

export async function patUser(interaction: ChatInputCommandInteraction) {
    return await interaction.reply(`$pat ${interaction.options.getUser("user", true).toString()}`);
}

export async function wolframAlpha(message: Message, command: "wolfram" | "wolf") {
    if (!isBotOwner(message.author)) return;

    const longAnswer = command === "wolfram";

    const query = message.content.split(" ").slice(1).join(" ");

    if (!query) return await message.channel.send("No query provided!");

    const endpoint = longAnswer ? "/v2/simple" : "/v1/result";

    const url = `http://api.wolframalpha.com${endpoint}?appid=${WOLFRAM_ALPHA_APP_ID}&i=${encodeURIComponent(
        query
    )}&background=181A1F&foreground=white&fontsize=30&units=metric&maxwidth=1500&output=json`;

    const response = await fetch(url).catch(console.error);

    if (!response) return await message.channel.send("Fetch failed, not sure why");

    if (!response.ok) {
        return await message.channel.send(
            `Something went wrong! HTTP ${response.status} ${response.statusText}`
        );
    }

    if (longAnswer) {
        const buffer = await response.arrayBuffer().catch(console.error);

        if (!buffer) {
            return await message.channel.send("Failed to extract the buffer for some reason?");
        }

        return await message.channel.send({ files: [Buffer.from(buffer)] });
    }

    const answer = await response.text().catch(console.error);
    if (!answer) return await message.channel.send("Failed to get the answer for some reason");
    return await message.channel.send(codeBlock(answer));
}

export async function checkForImgAndCreateThread(message: Message) {
    if (!IMAGE_THREAD_CHANNELS.includes(message.channel.id)) {
        return;
    }

    if (
        !hasPermission(message.member, PermissionFlagsBits.ManageMessages) &&
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
        !(
            isBotOwner(message.author) ||
            hasPermission(message.member, PermissionFlagsBits.MentionEveryone)
        )
    ) {
        return;
    }

    const amountInput = +message.content.split(" ")[1];
    const amount = Number.isNaN(amountInput) ? 1 : amountInput;

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
    const reactMsgs = await db.select().from(mikuReactions);
    const cmdAliases = await db.select().from(mikuCommandAliases);

    for (const item of cmdAliases) {
        if (item.alias === reactCmd) {
            const msg = randomElementFromArray(
                reactMsgs.filter((x) => x.command === item.command).map((x) => x.reaction)
            ).replace("{0}", message.member?.displayName ?? message.author.username);
            await Bun.sleep(1000);
            return await message.channel.send(msg);
        }
    }
}

export async function leet(input: Message | ChatInputCommandInteraction) {
    let inputWords: string[];

    if (isChatInputCommandInteraction(input)) {
        inputWords = input.options.getString("input", true).split(" ");
    } else {
        inputWords = input.content.split(" ").slice(1);
    }

    if (inputWords.length === 0) {
        return await sendOrReply(input, "You have to provide a string!");
    }

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

    await sendOrReply(input, leetOutput.substring(0, 2000), false);
}

export async function helpCmd(input: Message | ChatInputCommandInteraction, prefix?: string) {
    const helpMsgArray = await db.select().from(helpMessages).execute();

    if (helpMsgArray.length === 0) {
        return await sendOrReply(
            input,
            "Seems there aren't any help messages saved in the database"
        );
    }

    prefix ??= isDev() ? DEV_PREFIX : prefixMap.get(input.guild?.id ?? "") ?? DEFAULT_PREFIX;

    const helpMsg = helpMsgArray.map((msg) => `**${prefix}${msg.cmd}** - ${msg.desc}`).join("\n");

    const helpEmbed = new EmbedBuilder()
        .setColor(EMBED_COLOUR)
        .setTitle(`**${BOT_NAME}'s commands**`)
        .setDescription(helpMsg);

    return await sendOrReply(input, { embeds: [helpEmbed] });
}

export async function gitPull(message: Message) {
    if (!isBotOwner(message.author)) return;
    await cmdConsole(message, "git pull");
    await reloadBot(message);
}

export async function py(message: Message) {
    return await cmdConsole(message, undefined, true);
}

export async function cmdConsole(message: Message, cmd?: string, python = false) {
    if (!isBotOwner(message.author)) return;
    // Creates a new string with the message content without the command
    // And runs it in a new shell process

    const input = message.content.split(" ").slice(1).join(" ");
    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    const command = cmd
        ? cmd
        : python
          ? `${pythonCmd} -c "print(${input.replaceAll('"', '\\"')})"`
          : input;
    try {
        const { stdout, stderr } = await execPromise(command);
        if (stderr) await message.channel.send(codeBlock(stderr));

        const msg = stdout
            ? stdout.includes("\u001b[")
                ? codeBlock("ansi", stdout)
                : codeBlock(stdout)
            : "Command executed!";

        if (msg.length > 2000) return await message.channel.send("Command output too long!");
        return await message.channel.send(msg);
    } catch (error) {
        return await message.channel.send(codeBlock(error as string));
    }
}

export async function reloadBot(message: Message) {
    if (!isBotOwner(message.author)) return;
    await writeUpdateFile();
    exec("bun run restart");
    await message.channel.send("Reload successful!");
    process.exit(0);
}

export async function calc(message: Message) {
    return await jsEval(message, "math");
}

export async function jsEval(message: Message, mode?: "math") {
    if (!isBotOwner(message.author) && !mode) return;
    let rslt: string;

    // This is to be able to use all the functions inside the below eval function
    // Sleep call mostly to shut up typescript and eslint
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const tools = await import("../helpers/utils.js");

    const content = message.content.split(" ").filter(Boolean);

    if (content.length === 1) {
        return await message.channel.send("You have to type **SOMETHING** at least");
    }

    const command = message.content.split(" ").slice(1).join(" ");
    try {
        if (mode === "math") rslt = mathEvaluate(command) as string;
        else rslt = (await eval(command)) as string;
    } catch (error) {
        return await message.channel.send(codeBlock(error as string));
    }

    if (typeof rslt === "object") rslt = codeBlock("js", JSON.stringify(rslt, null, 2));
    if (rslt === "") return await message.channel.send("Cannot send an empty message!");

    const resultString = String(rslt);

    if (resultString === "" || resultString.length > 2000) {
        return await message.channel.send("Invalid message length for discord!");
    }
    return await message.channel.send(resultString);
}

export async function avatar(input: Message | ChatInputCommandInteraction) {
    let user: User;

    if (isChatInputCommandInteraction(input)) {
        user = input.options.getUser("user", false) ?? input.user;
    } else {
        const content = input.content.split(" ").filter(Boolean);
        const tmp = content.length === 1 ? input.author : await getUserObjectPingId(input);

        if (!tmp) return await sendOrReply(input, "Couldn't find the specified User");

        user = tmp;
    }

    assert(user, "[avatar] No user provided");

    const avatarURL = user.displayAvatarURL({ forceStatic: false, size: 4096 });

    if (!avatarURL) return await sendOrReply(input, "No avatar found!");

    const avatarEmbed = new EmbedBuilder()
        .setColor(EMBED_COLOUR)
        .setTitle(`*${user.displayName}'s Avatar*`)
        .setImage(avatarURL);

    return await sendOrReply(input, { embeds: [avatarEmbed] }, false);
}

export async function convert(input: ChatInputCommandInteraction | Message) {
    const currencies = {} as Record<string, string>;

    let amount: number;
    let base_currency: string;
    let target_currency: string;

    // The API can't seem to handle more than 7 or so decimal places
    if (isChatInputCommandInteraction(input)) {
        amount = +(input.options.getNumber("amount", false) ?? 1).toFixed(5);
        base_currency = input.options.getString("from", true).toUpperCase();
        target_currency = input.options.getString("to", true).toUpperCase();
    } else {
        const content = input.content.split(" ").filter(Boolean);
        if (content.length < 3) return await input.channel.send("Not enough arguments!");

        if (Number.isNaN(+content[1])) {
            amount = 1;
            base_currency = content[1].toUpperCase();
            target_currency = content[2].toUpperCase();
        } else {
            amount = +(+content[1]).toFixed(5);
            base_currency = content[2].toUpperCase();
            target_currency = content[3].toUpperCase();
        }
    }
    const codesResp = await fetch(
        `https://v6.exchangerate-api.com/v6/${EXCHANGE_API_KEY}/codes`
    ).catch(console.error);

    if (!codesResp) {
        return await sendOrReply(
            input,
            "Something went wrong while fetching the currencies! API is probably down or something"
        );
    }

    const supportedResult = (await codesResp.json().catch(console.error)) as SupportedCodesResponse;

    if (!supportedResult) {
        return await sendOrReply(
            input,
            "Something went really wrong, API didn't send JSON as a response. Probably best to try again later"
        );
    }

    if (!SupportedCodesSchema.safeParse(supportedResult).success) {
        return await sendOrReply(
            input,
            "Something went wrong while fetching the supported currencies! Please try again later"
        );
    }

    if (supportedResult.result === "error") {
        let msg: string;
        switch (supportedResult["error-type"]) {
            case "invalid-key":
                msg = `Invalid API key. This should never happen, please contact \`${OWNER_NAME}\``;
                break;
            case "quota-reached":
                msg = "API quota reached. Please try again later!";
                break;
            case "inactive-account":
                msg = `API account is inactive. Please contact \`${OWNER_NAME}\``;
                break;
            default:
                console.error(supportedResult);
                msg =
                    "Something went wrong fetching the supported currencies! Please try again later";
        }
        return await sendOrReply(input, msg);
    }

    for (const [code, name] of supportedResult.supported_codes) {
        currencies[code] = name;
    }

    if (!(base_currency in currencies && target_currency in currencies)) {
        return await sendOrReply(
            input,
            "Invalid currency codes!\nCheck " +
                "<https://www.exchangerate-api.com/docs/supported-currencies> " +
                "for a list of supported currencies"
        );
    }
    // Checks for possible pointless conversions
    if (base_currency === target_currency) {
        return await sendOrReply(input, "Your first currency is the same as your second currency!");
    }
    if (amount < 0) {
        return await sendOrReply(input, "You can't convert a negative amount!");
    }
    if (amount === 0) {
        return await sendOrReply(input, "Zero will obviously stay 0!");
    }

    const response = await fetch(
        `https://v6.exchangerate-api.com/v6/${EXCHANGE_API_KEY}/pair/${base_currency}/${target_currency}/${amount}`
    );

    const result = (await response.json().catch(console.error)) as PairConversionResponse;

    if (!result) {
        return await sendOrReply(
            input,
            "Something went really wrong, API didn't send JSON as a response. Probably best to try again later"
        );
    }

    if (!PairConversionResponseSchema.safeParse(result).success) {
        return await sendOrReply(input, "Something went wrong with the API, maybe try again later");
    }

    if (result.result === "error") {
        let msg: string;
        switch (result["error-type"]) {
            case "unsupported-code":
                msg = "One of the currencies you entered is not supported!";
                break;
            case "malformed-request":
                msg = "The request was malformed, please try again later!";
                break;
            case "invalid-key":
                msg = `Invalid API key. This should never happen, please contact ${OWNER_NAME}`;
                break;
            case "quota-reached":
                msg = "API quota reached. Please try again later!";
                break;
            case "inactive-account":
                msg = `API account is inactive. Please contact ${OWNER_NAME}`;
                break;
            default:
                console.error(result);
                msg = "Something went wrong with the API, maybe try again later";
        }
        return await sendOrReply(input, msg);
    }
    if (!response.ok) return await sendOrReply(input, "Error! Please try again later");

    const description = [
        `**${amount} ${currencies[base_currency]} ≈ `,
        `${result.conversion_result ?? 0} ${currencies[target_currency]}**`,
        `\n\nExchange Rate: 1 ${base_currency} ≈ ${result.conversion_rate ?? 0} ${target_currency}`,
    ].join("");

    let lastUpdated: string;

    try {
        lastUpdated = new Date(Date.parse(result.time_last_update_utc)).toUTCString();
    } catch (_) {
        lastUpdated = new Date().toUTCString();
    }

    const convertEmbed = new EmbedBuilder()
        .setColor(EMBED_COLOUR)
        .setTitle(`Converting ${base_currency} to ${target_currency}`)
        .setDescription(description)
        .setFooter({ text: `Last updated: ${lastUpdated}` });

    return await sendOrReply(input, { embeds: [convertEmbed] });
}

export async function urban(input: ChatInputCommandInteraction | Message) {
    let query: string;
    let random: boolean;

    if (isChatInputCommandInteraction(input)) {
        query = (input.options.getString("term", false) ?? "").toLowerCase();
        random = input.options.getBoolean("random", false) ?? false;
    } else {
        const content = input.content.split(" ").filter(Boolean);
        query = content.slice(1).join(" ").toLowerCase();
        random = content[1] === "random";
    }

    if (!query.length && !random) {
        return await sendOrReply(
            input,
            "You have to provide a search term or use the random flag",
            true
        );
    }

    if (isChatInputCommandInteraction(input)) await input.deferReply();

    const url = random
        ? "https://api.urbandictionary.com/v0/random"
        : `https://api.urbandictionary.com/v0/define?term=${query}`;

    const response = await fetch(url).catch(console.error);

    if (!response) {
        return await sendOrReply(
            input,
            "Something went wrong while fetching the definitions! API is probably down or something"
        );
    }

    if (!response.ok) {
        return await sendOrReply(input, `Error ${response.status}! Please try again later`);
    }

    const result = (await response.json().catch(console.error)) as UrbanResponse;

    if (!result) {
        return await sendOrReply(
            input,
            "Something went really wrong, API didn't send JSON. Probably best to try again later"
        );
    }

    if (!UrbanResponseSchema.safeParse(result).success) {
        return await sendOrReply(input, "Something went wrong with the API, maybe try again later");
    }

    if (result.list.length === 0) return await sendOrReply(input, "No results found!");

    const user = isChatInputCommandInteraction(input) ? input.user : input.author;
    const identifier = `${user.id}-${input.channelId}` as const;

    if (!urbanEmbeds[identifier]) urbanEmbeds[identifier] = [];

    setEmbedArr({
        result: result.list,
        user,
        sortKey: "thumbs_up",
        embedArray: urbanEmbeds[identifier],
        buildEmbedFunc: buildUrbanEmbed,
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`prevUrban-${identifier}`)
            .setLabel("PREV")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`nextUrban-${identifier}`)
            .setLabel("NEXT")
            .setStyle(ButtonStyle.Primary)
    );

    return await sendOrReply(input, {
        embeds: [urbanEmbeds[identifier][0].embed],
        components: [row],
    });
}

function buildUrbanEmbed(resultEntry: UrbanEntry, index: number, array: UrbanEntry[]) {
    const { word, definition, example, author, permalink, thumbs_up, thumbs_down } = resultEntry;

    const footerPagination = `${index + 1}/${array.length}`;

    const description = dedent`
        ${definition}

        **Example:** ${example}

        **Author:** ${author}

        **Permalink:** ${permalink}`.replace(/\]|\[/g, "");

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
    await message.client.destroy();
    exec("bun run stop");
    process.exit(0);
}
