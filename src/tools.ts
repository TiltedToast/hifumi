import * as fsPromise from "fs/promises";
import * as fs from "fs";
import * as path from "path";
import fetch from "node-fetch";
import { Headers } from "node-fetch";
import { mongoClient, client, statusArr } from "./app.js";
import { AnyChannel, Client, Message, TextChannel, User } from "discord.js";
import strftime from "strftime";
import { Document } from "mongodb";
import { StatusDoc } from "./interfaces.js";
import { promisify } from "util";
import { exec } from "child_process";
import { DEV_MODE, BOT_OWNER, DEV_CHANNELS } from "./config.js";

const execPromise = promisify(exec);

export async function resize(fileLocation: string, width: number, saveLocation: string): Promise<void> {
    if (fileLocation.endsWith(".gif")) {
        await execPromise(`gifsicle --resize-width ${width} ${fileLocation} > ${saveLocation}`);
    } else {
        if (process.platform === "win32") {
            await execPromise(`magick convert -resize ${width} ${fileLocation} ${saveLocation}`);
        } else {
            await execPromise(`convert -resize ${width} ${fileLocation} ${saveLocation}`);
        }
    }
}

/**
 * Parses key value pairs from discord messages into a JavaScript object that can be used to interact with the Database
 * @param  {number} start The content index after which arguments are expected to be present
 * @param {string[]} content The content of the message after being split by spaces
 * @returns Promise that resolves into the parsed argument document
 */
export async function parseDbArgs(start: number, content: string[]): Promise<Document> {
    const document: Document = {};

    // Loops over the argument pairs and adds them to as key value pairs in the document
    for (let i = start; i < content.length; i++) {
        if (i % 2 === 0) {
            if (content[i + 1].includes("_")) {
                document[content[i]] = content[i + 1].replace(/_/g, " ");
            } else {
                document[content[i]] = content[i + 1];
            }
        }
    }
    return document;
}

/**
 * Checks whether the currently active bot is the dev version or not
 * @returns {boolean} Whether or not the bot is the dev version
 */
export function isDev(): boolean {
    return DEV_MODE === "true";
}

/**
 * Starts a loop which periodically changes the status to a random entry in the database
 * @param {Client} client Discord client which is used to access the API
 */
export async function setRandomStatus(client: Client) {
    setInterval(async () => {
        if (!client.user) return console.log("Could not set status, client user is undefined");
        const randomStatusDoc = randomElementArray(statusArr) as StatusDoc;
        const randomType = randomStatusDoc.type;
        const randomStatus = randomStatusDoc.status;

        client.user.setActivity(randomStatus, { type: randomType });
    }, randomIntFromRange(300000, 900000));
}

/**
 * Simple function to create delays
 * @param {Number} ms The amount of milliseconds to wait
 */
export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Takes an object and returns the value of a random key
 * @param  {any} obj Javascript Object to check
 * @returns {any} Returns a random Property of an object
 */
export function randomProperty(obj: Record<string, unknown>): unknown {
    const keys = Object.keys(obj);
    return obj[keys[(keys.length * Math.random()) << 0]];
}

/**
 * Returns a user object from either a user id or a ping
 * @param {Message} message Discord message object
 * @returns The user object
 */
export async function getUserObjectPingId(message: Message): Promise<User | undefined> {
    const content = message.content.split(" ");

    if (!isNaN(parseInt(content[1]))) {
        return await client.users.fetch(content[1]);
    }
    const user = message.mentions.users.first();
    return user ? user : undefined;
}

/**
 * Takes an array and returns a random element from it.
 * @param {Array} array
 * @returns a random Element from the array
 */
export function randomElementArray(array: unknown[]): unknown {
    return array[Math.floor(Math.random() * array.length)];
}
/**
 * Returns a random integer between min (inclusive) and max (inclusive)
 * @param  {Number} min Minimum Integer value to return
 * @param  {Number} max Maximum Integer value to return
 * @returns a random integer between min and max
 */
export function randomIntFromRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * Parses an interaction and error and sends it to the channel to avoid Hifumi dying every time an Error occurs
 * @param {Message} message The Message object passed on each command execution
 * @param {Error} errorObject The error object that is passed to the command through try/catch
 */
export function errorLog(message: Message, errorObject: Error) {
    const currentTime = strftime("%d/%m/%Y %H:%M:%S");
    let channel: AnyChannel | undefined;
    let errorMessage: string;

    if (!message.guild) return message.channel.send(`Unknown guild!`);
    if (!errorObject) return message.channel.send(`Unknown error!`);

    const errorMessageWithoutStack = `An Error occurred on ${currentTime}
    **Server:** ${message.guild.name} - ${message.guild.id}
    **Room:** ${(message.channel as TextChannel).name} - ${message.channel.id}
    **User:** ${message.author.username} - ${message.author.id}
    **Command used:** ${message.content}
    **Error:** ${errorObject.message}`;

    const fullErrorMsg = `${errorMessageWithoutStack}\n\n**${errorObject.stack}\n\n<@${BOT_OWNER}>`;
    const preCutErrorMessage = fullErrorMsg.substring(0, 1900 - errorMessageWithoutStack.length);
    const postCutErrorMessage = `${preCutErrorMessage.split("\n").slice(0, -2).join("\n")}**\n\n<@${BOT_OWNER}>`;

    const collection = mongoClient.db("hifumi").collection("errorLog");
    collection.insertOne({
        server: message.guild.id,
        channel: message.channel.id,
        user: message.author.id,
        command: message.content,
        error: errorObject.message,
        stack: errorObject.stack,
        date: `${currentTime}`,
        timestamp: Date.now(),
        log: fullErrorMsg,
    });

    if (fullErrorMsg.length <= 2000) {
        errorMessage = fullErrorMsg;
    } else if (postCutErrorMessage.length > 2000) {
        errorMessage = `An Error occurred on ${currentTime}\nCheck console for full error (2000 character limit)\n<@258993932262834188>`;
    } else {
        errorMessage = postCutErrorMessage;
    }

    // Chooses channel to send error to
    // DEV_CHANNELS are channels that are actively used for testing purposes
    if (DEV_CHANNELS.includes(message.channel.id)) {
        channel = message.channel;
    } else {
        channel = client.channels.cache.get("655484804405657642");
    }

    (channel as TextChannel).send(errorMessage);
}

/**
 * Takes a URL as well as a file path and downloads the file to the file path
 * @param {String} url URL of the file you want to download
 * @param {String} saveLocation Path to save the file to
 */
export async function downloadURL(url: string, saveLocation: string) {
    const absSaveLocation = path.resolve(saveLocation);

    const myHeaders = new Headers();
    myHeaders.append("User-Agent", "hifumi-js:v1.0.0:tiltedtoast27@gmail.com");

    // Pixiv requires a Referrer header, no idea why
    if (url.includes("pximg")) myHeaders.append("Referer", "https://www.pixiv.net/");

    const requestOptions: Record<string, unknown> = {
        method: "GET",
        headers: myHeaders,
        redirect: "follow",
    };

    // Fetches the file from the URL and saves it to the file path
    const response = await fetch(url, requestOptions);
    if (!response.ok) return `Failed to download <${url}>: ${response.status} ${response.statusText}`;

    const buffer = await response.arrayBuffer();
    await fsPromise.writeFile(absSaveLocation, new Uint8Array(buffer));
}

/**
 * Takes an image URL and returns the file extension
 * @param {String} url The URL to whatever image you want to get the extension of
 * @returns {String} The file extension of the image
 */
export function getImgType(url: string): string {
    if (url.includes(".png") || url.includes(".webp")) return "png";
    else if (url.includes(".jpeg") || url.includes(".jpg")) return "jpeg";
    else if (url.includes(".gif")) return "gif";
    else if (url.includes(".svg")) return "svg";
    return "unknown";
}

/**
 * Takes a number and turns rounds it into an Integer or Float
 * @param {Number} x The number you want to round
 * @returns {Number} The rounded number
 */
export function advRound(x: number): number {
    if (Math.floor(x) + (x % 1) === parseInt(x.toString())) {
        return parseInt(x.toString());
    }
    return parseFloat(x.toString());
}

/**
 * Takes the raw string of a discord Emoji and either returns the ID or the url
 * @param {String} emojiString The emoji string
 * @param {Boolean} id Whether or not you only want the ID or the URL
 * @returns {String} The ID or URL of the emoji
 */
export function extractEmoji(emojiString: string, id?: boolean): string {
    const emojiID = emojiString.split(":")[2].slice(0, -1);

    if (id) return emojiID;

    if (emojiString[1] === "a") return `https://cdn.discordapp.com/emojis/${emojiID}.gif`;
    return `https://cdn.discordapp.com/emojis/${emojiID}.png`;
}

/**
 * Takes a directory, checks whether it exists. If it does, it deletes it and recreates it. If it doesn't, it creates it
 * @param {String} directory Path to the temporary directory you want to create
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
 * Checks whether the size of the file is greater than the max size allowed
 * @param {String} fileLocation The location of the file
 * @param {Number} size The max size allowed
 * @returns {Boolean} Whether or not the file is small enough
 */
export function isValidSize(fileLocation: string, size: number): boolean {
    return fs.statSync(fileLocation).size <= size;
}
