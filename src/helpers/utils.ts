import {
    Channel,
    GuildMember,
    Message,
    MessageType,
    PermissionResolvable,
    PermissionsBitField,
    TextChannel,
    User,
} from "discord.js";
import * as fs from "fs";
import * as fsPromise from "fs/promises";
import type { Document } from "mongodb";
import type { RequestInit } from "node-fetch";
import fetch, { Headers } from "node-fetch";
import * as path from "path";
import strftime from "strftime";
import { client, db } from "../app.js";
import { execPromise } from "../commands/miscellaneous.js";
import {
    BOT_OWNERS,
    DEV_CHANNELS,
    DEV_MODE,
    EXCHANGE_API_KEY,
    IMGUR_CLIENT_ID,
    IMGUR_CLIENT_SECRET,
    LOG_CHANNEL,
    PLANETSCALE_URL,
    REDDIT_CLIENT_ID,
    REDDIT_CLIENT_SECRET,
    REDDIT_REFRESH_TOKEN,
} from "../config.js";
import type {
    EmbedMetadata,
    ErrorLogOptions,
    ResizeOptions,
    UpdateEmbedArrParams,
    UpdateEmbedOptions,
} from "./types.js";
import { errorLogs } from "../db/schema.js";

export function splitMessage(content: string, maxLength = 2000, delim = " "): string[] {
    const chunks = [];
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

export function writeUpdateFile() {
    if (!fs.existsSync("./temp")) {
        fs.mkdirSync("./temp");
    }
    fs.writeFileSync("./temp/update.txt", Date.now().toString());
}

function getEmbedIndex(arr: EmbedMetadata[], target: EmbedMetadata): number {
    return arr.findIndex(
        (elem) =>
            elem.embed.toJSON().description?.replaceAll(/[\n\r\s]+/gi, "") ===
            target.embed.toJSON().description?.replaceAll(/[\n\r\s]+/gi, "")
    );
}

export function clientNoPermissions(message: Message, guildClient?: GuildMember): boolean {
    if (!guildClient) return false;
    return (
        !guildClient
            ?.permissionsIn(message.channel.id)
            .has(PermissionsBitField.Flags.SendMessages) ||
        !guildClient?.permissionsIn(message.channel.id).has(PermissionsBitField.Flags.ViewChannel)
    );
}

export function insideDocker(): boolean {
    return process.env["DOCKER"] === "true";
}

export function isBotOwner(user: User): boolean {
    return BOT_OWNERS.includes(user.id);
}

export function isMikuTrigger(message: Message, reactCmd: string): boolean {
    if (!client.user) return false;
    if (message.content.startsWith(`$${reactCmd}`) && message.type === MessageType.Reply) {
        const repliedMsg = message.channel.messages.resolve(message.reference?.messageId ?? "");
        if (!repliedMsg) return false;
        if (repliedMsg.author.id === client.user.id) return true;
    }

    return (
        message.content.startsWith(`$${reactCmd} <@${client.user.id}>`) ||
        message.content.startsWith(`$${reactCmd} <@!${client.user.id}>`)
    );
}

export async function setEmbedArr<T>(args: UpdateEmbedArrParams<T>): Promise<void> {
    const { result, userID, sortKey, embedArray, buildEmbedFunc } = args;

    if (sortKey) result.sort((a, b) => (b[sortKey] > a[sortKey] ? 1 : -1));

    embedArray.length = 0;
    for (let i = 0; i < result.length; i++) {
        embedArray.push({
            embed: buildEmbedFunc(result[i], i, result),
            user: userID,
        });
    }
}

export async function updateEmbed(options: UpdateEmbedOptions) {
    let newEmbed: EmbedMetadata;
    const { interaction, embedArray, prevButtonId, nextButtonId, user } = options;

    const activeIndex = getEmbedIndex(embedArray, {
        embed: interaction.message.embeds[0],
        user,
    });

    if (interaction.user.id !== embedArray[activeIndex].user) {
        return interaction.reply({
            content: "Run the command yourself to be able to cycle through the results",
            ephemeral: true,
        });
    }
    if (activeIndex === 0 && interaction.customId === prevButtonId) {
        newEmbed = embedArray[embedArray.length - 1];
    } else if (activeIndex === embedArray.length - 1 && interaction.customId === nextButtonId) {
        newEmbed = embedArray[0];
    } else {
        newEmbed = embedArray[activeIndex + (interaction.customId === prevButtonId ? -1 : 1)];
    }
    return await interaction.update({ embeds: [newEmbed.embed] });
}

/**
 * Checks if the user invoking the command has the specified permission(s)
 * @param permission A valid permission to check, see
 * {@link https://discord.js.org/#/docs/discord.js/main/typedef/PermissionResolvable accepted values}
 * @param message Message object passed through the command
 */
export function hasPermission(permission: PermissionResolvable, message: Message): boolean {
    if (!message.member) return false;
    return message.member.permissions.has(permission);
}

/**
 * Checks config variables for missing credentials
 * @returns a list of missing credentials
 */
export async function getMissingCredentials(): Promise<string[]> {
    const missingCredentials = [];
    if (!EXCHANGE_API_KEY) missingCredentials.push("Exchange API Key");
    if (!IMGUR_CLIENT_ID) missingCredentials.push("Imgur Client ID");
    if (!IMGUR_CLIENT_SECRET) missingCredentials.push("Imgur Client Secret");
    if (!REDDIT_CLIENT_ID) missingCredentials.push("Reddit Client ID");
    if (!REDDIT_CLIENT_SECRET) missingCredentials.push("Reddit Client Secret");
    if (!REDDIT_REFRESH_TOKEN) missingCredentials.push("Reddit Refresh Token");
    if (!PLANETSCALE_URL) missingCredentials.push("PlanetScale URL");
    return missingCredentials;
}

/**
 * Takes the file path of an image/gif and resizes it
 * @param options An object containing the file location, width, and save location
 */
export async function resize(options: ResizeOptions) {
    const { fileLocation, width, saveLocation } = options;
    if (fileLocation.endsWith(".gif")) {
        return await execPromise(
            `gifsicle --resize-width ${width} ${fileLocation} -o ${saveLocation}`
        );
    } else {
        const cmdPrefix = process.platform === "win32" ? "magick convert" : "convert";
        return await execPromise(`${cmdPrefix} -resize ${width} ${fileLocation} ${saveLocation}`);
    }
}

/**
 * Parses key value pairs from discord messages into a JavaScript object
 * that can be used to interact with the Database
 * @param startIndex The content index after which arguments are expected to be present
 * @param content The content of the message after being split by spaces
 * @returns Document that contains all the parsed arguments
 */
export function parseDbArgs(startIndex: number, content: string[]): Document {
    const document: Document = {};
    const evenOrOdd = startIndex % 2 === 0 ? 0 : 1;
    // Loops over the argument pairs and adds them to as key value pairs in the document
    for (let i = startIndex; i < content.length; i += 2) {
        if (i % 2 === evenOrOdd) {
            document[content[i]] = content[i + 1].replace(/_/g, " ");
        }
    }
    return document;
}

/**
 * Checks whether the currently active bot is the dev version or not
 */
export function isDev(): boolean {
    return DEV_MODE === "true";
}

/**
 * Create a simple delay
 * @param ms The amount of milliseconds the delay should last for
 */
export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns a user object from either a user id or a ping
 * @param message Discord message object
 * @returns The user object
 */
export async function getUserObjectPingId(message: Message): Promise<User | undefined> {
    let user: User | undefined;
    const content = message.content.split(" ");
    const pingOrIdString = content[1];

    try {
        if (!isNaN(parseInt(pingOrIdString))) user = await client.users.fetch(pingOrIdString);
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
 * Hifumi dying every time an error occurs
 * @param message The Message object passed on each command execution
 * @param errorObject The error object that is passed to the command through try/catch
 */
export async function errorLog({ message, errorObject }: ErrorLogOptions) {
    const currentTime = strftime("%d/%m/%Y %H:%M:%S");
    let channel: Channel | undefined;
    let errorMessage: string;

    if (message === undefined) {
        channel = client.channels.cache.get(LOG_CHANNEL) as TextChannel;
        errorMessage = `Unhandled Rejection\n\n${errorObject.stack}\n\n<@${BOT_OWNERS[0]}>`;
        return channel.send(errorMessage);
    }

    const commandUsed =
        message.content.substring(0, 500) +
        (message.content.substring(0, 500) !== message.content ? " ..." : "");

    const errorMessageWithoutStack =
        `An Error occurred on ${currentTime}\n` +
        `**Server:** ${message.guild?.name} - ${message.guild?.id}\n` +
        `**Room:** ${(message.channel as TextChannel).name} - ${message.channel.id}\n` +
        `**User:** ${message.author.username} - ${message.author.id}\n` +
        `**Command used:** ${commandUsed}\n` +
        `**Error:** ${errorObject.message}\n`;

    const fullErrorMsg = `${errorMessageWithoutStack}\n\n**${errorObject.stack}**\n\n<@${BOT_OWNERS[0]}>`;
    const preCutErrorMessage = fullErrorMsg.substring(0, 1900 - errorMessageWithoutStack.length);
    const postCutErrorMessage = `${preCutErrorMessage.split("\n").slice(0, -2).join("\n")}**\n\n<@${
        BOT_OWNERS[0]
    }>`;

    db.insert(errorLogs)
        .values({
            server: message.guild?.id ?? "DM",
            channel: message.channel.id,
            user: message.author.id,
            command: message.content,
            error: errorObject.message,
            stack: errorObject.stack,
            timestamp: strftime("%Y-%m-%d %H:%M:%S"),
            log: fullErrorMsg,
        })
        .execute()
        .catch(console.error);

    if (fullErrorMsg.length <= 2000) {
        errorMessage = fullErrorMsg;
    } else if (postCutErrorMessage.length > 2000) {
        errorMessage = `An Error occurred on ${currentTime}\nCheck console for full error (2000 character limit)\n<@${BOT_OWNERS[0]}>`;
    } else {
        errorMessage = postCutErrorMessage;
    }

    // Chooses channel to send error to
    // DEV_CHANNELS are channels that are actively used for testing purposes
    if (DEV_CHANNELS.includes(message.channel.id)) {
        channel = message.channel;
    } else {
        channel = client.channels.cache.get(LOG_CHANNEL);
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

    const myHeaders = new Headers();
    myHeaders.append("User-Agent", "hifumi-js:v1.0.0:tiltedtoast27@gmail.com");

    // Pixiv requires a Referer header
    if (url.includes("pximg")) myHeaders.append("Referer", "https://www.pixiv.net/");

    const requestOptions: RequestInit = {
        method: "GET",
        headers: myHeaders,
        redirect: "follow",
    };

    // Fetches the file from the URL and saves it to the file path
    const response = await fetch(url, requestOptions);
    if (!response.ok) {
        return `Failed to download <${url}>\n${response.status} ${response.statusText}`;
    }

    const buffer = await response.arrayBuffer();
    return await fsPromise.writeFile(absSaveLocation, new Uint8Array(buffer));
}

/**
 * Takes an image URL and returns the file extension
 * @param url The URL to whatever image you want to get the extension of
 * @returns The file extension of the image
 */
export function getImgType(url: string) {
    if (url.includes(".png") || url.includes(".webp")) return "png";
    else if (url.includes(".jpeg") || url.includes(".jpg")) return "jpeg";
    else if (url.includes(".gif")) return "gif";
    else if (url.includes(".svg")) return "svg";
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

/**
 * Takes a directory, checks whether it exists. If it does, it deletes it and recreates it.
 *  If it doesn't, it creates it
 * @param directory Path to the temporary directory you want to create
 */
export function createTemp(directory: string): void {
    const absPath = path.resolve(directory);

    if (fs.existsSync(absPath)) {
        fs.rmSync(absPath, { recursive: true });
        fs.mkdirSync(absPath);
    } else {
        fs.mkdirSync(absPath);
    }
}

/**
 * Checks whether the size of the file is smaller than the max size allowed or not
 * @param fileLocation The location of the file
 * @param size The max size allowed in bytes or one of the presets from {@link FileSizeLimit}
 */
export function isValidSize(fileLocation: string, size: number): boolean {
    return fs.statSync(fileLocation).size <= size;
}
