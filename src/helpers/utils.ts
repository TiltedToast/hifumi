import dedent from "dedent";
import {
    CommandInteraction,
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
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import strftime from "strftime";
import { table } from "table";
import { client } from "../app.ts";
import { BOT_OWNERS, DEV_CHANNELS, LOG_CHANNEL, OWNER_NAME } from "../config.ts";
import { db } from "../db/index.ts";
import { errorLogs } from "../db/schema.ts";
import type {
    EmbedMetadata,
    ErrorLogOptions,
    ResizeOptions,
    UpdateEmbedArrParams,
    UpdateEmbedOptions,
} from "./types.ts";

export function formatTable<K extends string | number | symbol, V>(rows: Record<K, V>[]): string {
    const MIN_WRAP_LENGTH = 30;

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

export function isCommandInteraction(
    input: Message | CommandInteraction
): input is CommandInteraction {
    return input instanceof CommandInteraction;
}

export function isMessage(input: Message | CommandInteraction): input is Message {
    return input instanceof Message;
}

/**
 * Send a message if the input is a message, or reply if the input is a command interaction
 * @param input Message or CommandInteraction
 * @param message Whatever you want to send or reply with
 * @param ephemeral Whether or not the message should be ephemeral (only visible to the user who invoked the command, this is true by default and only for command interactions)
 */
export async function sendOrReply(
    input: Message | CommandInteraction,
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
    return await input.channel?.send(message);
}

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
    if (!existsSync("./temp")) {
        mkdirSync("./temp");
    }
    writeFileSync("./temp/update.txt", Date.now().toString());
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
    return !(
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

export function isMikuTrigger(message: Message, reactCmd: string): boolean {
    if (!client.user) return false;
    if (message.content.startsWith(`$${reactCmd}`) && message.type === MessageType.Reply) {
        const repliedMsg = message.channel.messages.resolve(message.reference?.messageId ?? "");
        if (!repliedMsg) return false;
        if (repliedMsg.author.id === client.user.id) return true;
    }

    return message.content.startsWith(`$${reactCmd}`) && message.content.includes(client.user.id);
}

export function setEmbedArr<T>(args: UpdateEmbedArrParams<T>): void {
    const { result, user, sortKey, embedArray, buildEmbedFunc } = args;

    if (sortKey) result.sort((a, b) => (b[sortKey] > a[sortKey] ? 1 : -1));

    embedArray.length = 0;
    for (let i = 0; i < result.length; i++) {
        embedArray.push({
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

    if (interaction.user.id !== embedArray[activeIndex].user.id) {
        return interaction.reply({
            content: "Run the command yourself to be able to cycle through the results",
            ephemeral: true,
        });
    }

    const step = { [prevButtonId]: -1, [nextButtonId]: 1 }[interaction.customId];
    if (!step) {
        return interaction.reply({
            content: `Invalid button for some reason. Something must've gone VERY wrong, please let my owner ${OWNER_NAME} know about this if you can`,
            ephemeral: true,
        });
    }
    // -1 % 10 = -1 (Why are you like this JS)
    const newEmbed = embedArray.at((activeIndex + step) % embedArray.length) as EmbedMetadata;

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
    if (animated) {
        return await Bun.spawn([
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
    const content = message.content.split(" ").filter(Boolean);
    const pingOrIdString = content[1];

    try {
        if (!Number.isNaN(parseInt(pingOrIdString)))
            user = await client.users.fetch(pingOrIdString);
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
 * the bot dying every time an error occurs
 * @param message The Message object passed on each command execution
 * @param errorObject The error object that is passed to the command through try/catch
 */
export function errorLog({ message, errorObject }: ErrorLogOptions) {
    const currentTime = strftime("%d/%m/%Y %H:%M:%S");
    let channel: Channel | undefined;
    let errorMessage: string;

    if (message === undefined) {
        channel = client.channels.cache.get(LOG_CHANNEL) as TextChannel;
        errorMessage = dedent`
        Unhandled Rejection

        ${errorObject.stack ?? "Stack missing"}

        <@${BOT_OWNERS[0]}>`;
        return channel.send(errorMessage);
    }

    const commandUsed =
        message.content.substring(0, 500) +
        (message.content.substring(0, 500) !== message.content ? " ..." : "");

    const errorMessageWithoutStack = dedent`
        An Error occurred on ${currentTime}
        **Server:** ${message.guild?.name ?? "Unknown"} - ${message.guild?.id ?? "Unknown"}
        **Room:** ${(message.channel as TextChannel).name} - ${message.channel.id}
        **User:** ${message.author.username} - ${message.author.id}
        **Command used:** ${commandUsed}
        **Error:** ${errorObject.message}`;

    const fullErrorMsg = dedent`
        ${errorMessageWithoutStack}

    **${errorObject.stack ?? "Stack missing"}**

    <@${BOT_OWNERS[0]}>`;

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
    const absSaveLocation = resolve(saveLocation);

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

    const buffer = await response.arrayBuffer().catch(console.error);

    if (!buffer) return "Failed to extract contents from response";
    return writeFileSync(absSaveLocation, new Uint8Array(buffer));
}

/**
 * Takes an image URL and returns the file extension
 * @param url The URL to whatever image you want to get the extension of
 * @returns The file extension of the image
 */
export function getImgType(url: string) {
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

/**
 *  Create a temporary directory in the CWD, if it already exists, delete it and create a new one
 * Default to "temp" if no name is provided
 * @param directory Path to the temporary directory you want to create
 */
export function createTemp(name = "temp"): void {
    const absPath = resolve(name);

    if (existsSync(absPath)) {
        rmSync(absPath, { recursive: true });
        mkdirSync(absPath);
    } else {
        mkdirSync(absPath);
    }
}

/**
 * Checks whether the size of the file is smaller than the max size allowed or not
 * @param fileLocation The location of the file
 * @param size The max size allowed in bytes or one of the presets from {@link FileSizeLimit}
 */
export function isValidSize(fileLocation: string, size: number): boolean {
    return statSync(fileLocation).size <= size;
}
