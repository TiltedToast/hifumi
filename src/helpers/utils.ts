import dedent from "dedent";
import {
    ChatInputCommandInteraction,
    GuildMember,
    Message,
    MessageType,
    PermissionsBitField,
    TextChannel,
    User,
    type BaseMessageOptions,
    type Channel,
    type PermissionResolvable,
} from "discord.js";
import gifsicle from "gifsicle";
import assert from "node:assert/strict";
import { existsSync, rmSync, statSync } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import os from "os";
import sharp from "sharp";
import strftime from "strftime";
import { table } from "table";
import { BOT_OWNERS, DEV_CHANNELS, LOG_CHANNEL, OWNER_NAME } from "../config.ts";
import { db } from "../db/index.ts";
import { errorLogs } from "../db/schema.ts";
import type {
    EmbedData,
    ErrorLogOptions,
    ResizeOptions,
    UpdateEmbedArrParams,
    UpdateEmbedOptions,
} from "./types.ts";

export function formatTable<K extends string | number | symbol, V>(rows: Record<K, V>[]): string {
    const MIN_WRAP_LENGTH = 30;

    assert(rows.length > 0, "Must have at least one row");
    assert(Object.keys(rows[0]).length > 0, "Must have at least one column");

    const keys = Object.keys(rows[0]);
    const values = rows.map((obj) => Object.values(obj));

    const columns = {} as { [key: number]: { width: number } };

    for (let i = 0; i < values[0].length; i++) {
        const minVal = Math.min(
            MIN_WRAP_LENGTH,
            Math.max(...values.map((v) => String(v[i]).length))
        );
        columns[i] = {
            width: minVal >= keys[i].length ? minVal : keys[i].length,
        };
    }

    return table([keys, ...values], {
        columnDefault: {
            wrapWord: true,
        },
        columns,
    });
}

export function isChatInputCommandInteraction(
    input: Message | ChatInputCommandInteraction
): input is ChatInputCommandInteraction {
    return input instanceof ChatInputCommandInteraction;
}

export function isMessage(input: Message | ChatInputCommandInteraction): input is Message {
    return input instanceof Message;
}

/**
 * Send a message if the input is a message, or reply if the input is a command interaction
 * @param input Message or CommandInteraction
 * @param message Whatever you want to send or reply with
 * @param ephemeral Whether or not the message should be ephemeral (only visible to the user who invoked the command, this is true by default and only for command interactions)
 */
export async function sendOrReply(
    input: Message | ChatInputCommandInteraction,
    message: string | BaseMessageOptions,
    ephemeral = true
) {
    if (input instanceof Message) {
        return await input.channel.send(message);
    }
    if (input.deferred) {
        return await input.editReply(message);
    }
    if (input.isRepliable() && typeof message === "string") {
        return await input.reply({ content: message, ephemeral });
    }
    if (input.isRepliable()) {
        return await input.reply({ ...(message as BaseMessageOptions), ephemeral });
    }
}

export function splitMessage(content: string, maxLength = 2000, delim = " "): string[] {
    const chunks: string[] = [];
    let currentChunk = "";
    for (const word of content.split(delim)) {
        if (currentChunk.length + word.length + delim.length > maxLength) {
            chunks.push(currentChunk);
            currentChunk = "";
        }
        currentChunk += word + delim;
    }
    if (currentChunk.length > 0) chunks.push(currentChunk);
    return chunks;
}

export async function writeUpdateFile() {
    await Bun.write("/tmp/hifumi_update.txt", Date.now().toString());
}

function getEmbedIndex(arr: EmbedData[], target: EmbedData): number {
    return arr.findIndex(
        (elem) => elem.embed.toJSON().description === target.embed.toJSON().description
    );
}

export function clientHasPermissions(message: Message, guildClient?: GuildMember): boolean {
    if (!guildClient) return false;
    return (
        guildClient.permissionsIn(message.channel.id).has(PermissionsBitField.Flags.SendMessages) &&
        guildClient.permissionsIn(message.channel.id).has(PermissionsBitField.Flags.ViewChannel)
    );
}

export function insideDocker(): boolean {
    return process.env["DOCKER"] === "true";
}

export function isBotOwner(user: User): boolean {
    return BOT_OWNERS.includes(user.id);
}

export function isAiTrigger(message: Message, reactCmd: string): boolean {
    if (!message.client.user) return false;
    if (message.content.startsWith(`$${reactCmd}`) && message.type === MessageType.Reply) {
        const repliedMsg = message.channel.messages.resolve(message.reference?.messageId ?? "");
        if (!repliedMsg) return false;
        if (repliedMsg.author.id === message.client.user.id) return true;
    }

    return (
        message.content.startsWith(`$${reactCmd}`) &&
        message.content.includes(message.client.user.id)
    );
}

export function setEmbedArr<T>(args: UpdateEmbedArrParams<T>): void {
    const { result, user, sortKey, buildEmbedFunc } = args;

    if (sortKey) result.sort((a, b) => (b[sortKey] > a[sortKey] ? 1 : -1));

    args.embedArray.length = 0;
    for (let i = 0; i < result.length; i++) {
        args.embedArray.push({
            embed: buildEmbedFunc(result[i], i, result),
            user,
        });
    }
}

export async function updateEmbed(options: UpdateEmbedOptions) {
    const { interaction, embedArray, prevButtonId, nextButtonId, user } = options;

    const activeIndex = getEmbedIndex(embedArray, {
        embed: interaction.message.embeds[0],
        user,
    });

    if (activeIndex === -1) {
        return await interaction.reply({
            content: "Something went wrong, please try again",
            ephemeral: true,
        });
    }

    assert(embedArray.length > 1, "Embed array must have at least two elements");

    if (interaction.user.id !== embedArray[activeIndex].user.id) {
        return interaction.reply({
            content: "Only the person who initiated the command can use these buttons, sorry!",
            ephemeral: true,
        });
    }

    const step = { [prevButtonId]: -1, [nextButtonId]: 1 }[interaction.customId];
    if (!step) {
        await interaction.reply({
            content: `Invalid button for some reason. Something must've gone VERY wrong, please let my owner \`${OWNER_NAME}\` know about this if you can`,
            ephemeral: true,
        });
    }

    assert(step !== undefined, "Step must be defined");

    const newEmbed = embedArray[(activeIndex + step + embedArray.length) % embedArray.length];

    return await interaction.update({ embeds: [newEmbed.embed] });
}

/**
 * Checks if the user invoking the command has the specified permission(s)
 * @param permission A valid permission to check, see
 * {@link https://discord.js.org/#/docs/discord.js/main/typedef/PermissionResolvable accepted values}
 * @param member The Guild Member you want to check the permissions of
 */
export function hasPermission(
    member: GuildMember | null,
    permission: PermissionResolvable
): boolean {
    if (!member) return false;
    return member.permissions.has(permission);
}

/**
 * Takes the file path of an image/gif and resizes it
 * @param options An object containing the file location, width, and save location
 */
export async function resize(options: ResizeOptions) {
    const { fileLocation, width, saveLocation, animated } = options;

    assert(width > 0, "Width must be greater than 0");
    assert(existsSync(fileLocation), "File must exist");

    if (animated) {
        return Bun.spawn([
            gifsicle,
            "--resize-width",
            width.toString(),
            fileLocation,
            "-o",
            saveLocation,
        ]).exited;
    }
    return await sharp(fileLocation).resize(width).toFile(saveLocation).catch(console.error);
}

/**
 * Checks whether the currently active bot is the dev version or not
 */
export function isDev(): boolean {
    return process.env.DEV_MODE === "true";
}

/**
 * Returns a user object from either a user id or a ping
 * @param message Discord message object
 * @returns The user object
 */
export async function getUserObjectPingId(message: Message): Promise<User | undefined> {
    let user: User | undefined;
    const content = message.content.split(" ").filter(Boolean);
    const pingOrIdString = content[1];

    try {
        if (!Number.isNaN(parseInt(pingOrIdString)))
            user = await message.client.users.fetch(pingOrIdString);
        if (!user && pingOrIdString.startsWith("<")) user = message.mentions.users.first();
        return user ? user : undefined;
    } catch (err) {
        return undefined;
    }
}

/**
 * Takes an array and returns a random element from it.
 * @param array The input array
 * @returns a random element from the array
 */
export function randomElementFromArray<T>(array: T[]): T {
    assert(array.length > 0, "Array must have at least one element");
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Returns a random integer between min (inclusive) and max (inclusive)
 * @param min Minimum Integer value to return
 * @param max Maximum Integer value to return
 * @returns a random integer between min and max
 */
export function randomIntFromRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * Parses a message and error and sends it to the channel to avoid
 * the bot dying every time an error occurs
 * @param message The Message object passed on each command execution
 * @param errorObject The error object that is passed to the command through try/catch
 */
export function errorLog({ message, errorObject }: ErrorLogOptions) {
    const currentTime = strftime("%d/%m/%Y %H:%M:%S");
    let channel: Channel | undefined;
    let errorMessage: string;

    const commandUsed =
        message.content.substring(0, 500) +
        (message.content.substring(0, 500) !== message.content ? " ..." : "");

    const errorMessageWithoutStack = dedent`
        An Error occurred on ${currentTime}
        **Server:** ${message.guild?.name ?? "Unknown"} - ${message.guild?.id ?? "DM"}
        **Room:** ${(message.channel as TextChannel).name} - ${message.channel.id}
        **User:** ${message.author.username} - ${message.author.id}
        **Command used:** ${commandUsed}
        **Error:** ${errorObject.message}`;

    const fullErrorMsg = dedent`
    ${errorMessageWithoutStack}

    **${errorObject.stack ?? "Stack missing"}**

    <@${BOT_OWNERS[0]}>`;

    const preCutErrorMessage = fullErrorMsg.substring(0, 1900 - errorMessageWithoutStack.length);

    const postCutErrorMessage = dedent`
    ${preCutErrorMessage.split("\n").slice(0, -2).join("\n")}**

    <@${BOT_OWNERS[0]}>`;

    db.insert(errorLogs)
        .values({
            server: message.guild?.id ?? "DM",
            channel: message.channel.id,
            user: message.author.id,
            command: message.content,
            error: errorObject.message,
            stack: errorObject.stack,
            log: fullErrorMsg,
        })
        .execute()
        .catch(console.error);

    if (fullErrorMsg.length <= 2000) {
        errorMessage = fullErrorMsg;
    } else if (postCutErrorMessage.length > 2000) {
        console.error(fullErrorMsg);
        errorMessage = dedent`
            An Error occurred on ${currentTime}
            Check console for full error (2000 character limit)
            <@${BOT_OWNERS[0]}>`;
    } else {
        errorMessage = postCutErrorMessage;
    }

    // Chooses channel to send error to
    // DEV_CHANNELS are channels that are actively used for testing purposes
    if (DEV_CHANNELS.includes(message.channel.id)) {
        channel = message.channel;
    } else {
        channel = message.client.channels.cache.get(LOG_CHANNEL);
    }
    return (channel as TextChannel).send(errorMessage);
}

/**
 * Takes a URL as well as a file path and downloads the file to the file path
 * @param url URL of the file you want to download
 * @param saveLocation Path to save the file to
 */
export async function downloadURL(url: string, saveLocation: string) {
    const absSaveLocation = path.resolve(saveLocation);

    const myHeaders = new Headers({
        "User-Agent": "hifumi-js:v1.0.0:tiltedtoast27@gmail.com",
    });

    // Pixiv will only allow you to download images if you have a referer header
    if (url.includes("pximg")) myHeaders.append("Referer", "https://www.pixiv.net/");

    const requestOptions: RequestInit = {
        method: "GET",
        headers: myHeaders,
        redirect: "follow",
    };

    // Fetches the file from the URL and saves it to the file path
    const response = await fetch(url, requestOptions).catch(console.error);

    if (!response) return `Failed to fetch ${url}`;

    if (!response.ok) {
        return `Failed to download <${url}>\n${response.status} ${response.statusText}`;
    }

    if (!response.body) return "Failed to extract contents from response";

    try {
        const writer = Bun.file(absSaveLocation).writer();

        for await (const chunk of response.body) {
            writer.write(chunk as Uint8Array);
        }

        await writer.flush();
        await writer.end();
    } catch (err) {
        console.error(err);
        return `Failed to write to file`;
    }
}

/**
 * Takes an image URL and returns the file extension
 * @param url The URL to whatever image you want to get the extension of
 * @returns The file extension of the image
 */
export function getImgType(url: string) {
    assert(url.length > 0, "URL must have at least one character");
    if (url.includes(".png") || url.includes(".webp")) return "png";
    if (url.includes(".jpeg") || url.includes(".jpg")) return "jpeg";
    if (url.includes(".gif")) return "gif";
    if (url.includes(".svg")) return "svg";
    return undefined;
}

/**
 * Takes the raw string of a discord Emoji and either returns the ID or the url
 * @param emojiString The emoji string
 * @param IdOnly Whether or not you only want the ID or the URL
 * @returns The ID or URL of the emoji
 */
export function extractEmoji(emojiString: string, IdOnly = false): string {
    const emojiID = emojiString.split(":")[2].slice(0, -1);
    if (IdOnly) return emojiID;

    const extension = emojiString[1] === "a" ? "gif" : "png";

    return `https://cdn.discordapp.com/emojis/${emojiID}.${extension}`;
}

function deleteTemp(folder: string) {
    assert(existsSync(folder), "Folder must exist");
    rmSync(folder, { recursive: true, force: true });
}

/**
 * Takes a Message or Interaction and creates a temporary folder for the message.
 *
 * ## **After 1 minute, the folder will be automatically wiped.**
 *
 * @param input The Message or Interaction
 * @returns The path to the temporary folder
 */
export async function createTemp(input: Message | ChatInputCommandInteraction): Promise<string> {
    const tempFolder = os.tmpdir();

    const tempPath = path.join(
        tempFolder,
        `hifumi-${input.channel?.id ?? "NO_CHANNEL"}-${input.id}`
    );

    await mkdir(tempPath);

    setTimeout(() => deleteTemp(tempPath), 60 * 1000); // Clean up after 1 minute

    return tempPath;
}

/**
 * Wipes all temporary folders created by hifumi.
 *
 * We don't want to leave any trash behind do we? (If only others did the same...)
 */
export async function wipeTempFolders() {
    const tempFolder = os.tmpdir();
    const items = await readdir(tempFolder);
    for (const item of items) {
        if (item.startsWith("hifumi-")) {
            deleteTemp(path.join(tempFolder, item));
        }
    }
}

/**
 * Checks whether the size of the file is smaller than the max size allowed or not
 * @param fileLocation The location of the file
 * @param size The max size allowed in bytes or one of the presets from {@link FileSizeLimit}
 */
export function isValidSize(fileLocation: string, size: number) {
    assert(existsSync(fileLocation), "File must exist");
    return statSync(fileLocation).size <= size;
}
