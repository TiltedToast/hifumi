import * as fsPromise from 'fs/promises';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { Headers } from 'node-fetch';
import { credentials } from './config.js';
import { Db, ObjectId } from "mongodb";
import { mongoClient, client, statusArr } from './app.js';
import { Client, Message, TextChannel, User } from 'discord.js';
import Snoowrap from 'snoowrap';
import { Timespan } from 'snoowrap/dist/objects/Subreddit';
import strftime from 'strftime';


/**
 * Starts a loop which periodically changes the status to a random entry in the database
 * @param {Client} client Discord client which is used to access the API
 */
export async function setRandomStatus(client: Client) {
    setInterval(async () => {
        if (!client.user) return;
        const randomStatusDoc = randomElementArray(statusArr);
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
    return new Promise(resolve => setTimeout(resolve, ms));
}


export function randomProperty(obj: any) {
    const keys = Object.keys(obj);
    return obj[keys[ keys.length * Math.random() << 0]];
};

/**
 * Returns a user object from either a user id or a ping 
 * @param {Message} message Discord message object
 * @returns The user object
 */
export async function getUserObjectPingId(message: Message): Promise<User | undefined> {
    const content = message.content.split(" ");

    if (content.length === 1) {
        return message.author;
    } else if (!isNaN(parseInt(content[1]))) {
        return await client.users.fetch(content[1]);
    } else if (message.mentions.has(message.channel.id)) {
        return message.mentions.users.first();
    }
}


/**
 * Takes an array and returns a random element from it.
 * @param {Array} array 
 * @returns a random Element from the array
 */
export function randomElementArray(array: Array<any>): any {
    return array[Math.floor(Math.random() * array.length)]
}
/**
 * Returns a random integer between min (inclusive) and max (inclusive)
 * @param  {Number} min Minimium Integer value to return
 * @param  {Number} max Maximum Integer value to return
 * @returns a random integer between min and max
 */
export function randomIntFromRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min)
}

/**
 * Fetches submissions from a Subreddit and stores them in the database
 * @param {String} subreddit The subreddit to fetch posts from
 * @param {String} mode The type of top posts to fetch
 * @param {Integer} counter Number used to calculate the total fetched submissions
 * @param {Db} db Database to store the fetched submissions in
 * @param {Snoowrap} RedditClient Snoowrap Reddit Client instance
 * @param {Number} limit Amount of posts to fetch
 * @returns {Promise} Promise that resolves to the amount of submissions fetched
 */
export async function fetchTopPosts(subreddit: string, mode: Timespan, counter: number, db: Db, RedditClient: Snoowrap, limit: number = 100): Promise<number> {
    // Fetches Top posts from a subreddit
    // Only accepts images hosted on reddit or imgur to avoid Embeds not working
    const submissions = await RedditClient.getSubreddit(subreddit).getTop({ time: mode, limit: limit });
    const collection = db.collection(`${subreddit}`);
    for (let submission of submissions) {
        if (await collection.findOne({ id: submission.id }) === null && !submission.is_self
            && (submission.url.includes("i.redd.it") || submission.url.includes("i.imgur.com"))) {
            await collection.insertOne(JSON.parse(JSON.stringify(submission)));
            counter += 1;
        }
    }
    return counter;
}


/**
 * Parses an array of interaction.options.data to get applied options
 * !Assumes you're using slash commands
 * @param {Array} array Array of strings
 * @returns an array that contains the input options
 */
export function getOptionsArray(array: Array<any>) {
    let optionsArray = [];
    for (let i = 0; i < array.length; i++) {
        optionsArray.push(array[i].name);
    }
    return optionsArray;
}

/**
 * Parses an interaction and error and sends it to the channel to avoid Hifumi dying every time an Error occurs
 * @param {BaseCommandInteraction} interaction The Interaction that is unique to each command execution
 * @param {Error} errorObject The error object that is passed to the command through try/catch
 */
export function errorLog(message: Message, errorObject: Error) {
    const currentTime = strftime("%d/%m/%Y %H:%M:%S");
    let channel;

    if (!message.guild) return message.channel.send(`Unknown guild!`);

    let errorMessage = `An Error occurred on ${currentTime}
  **Server:** ${message.guild.name} - ${message.guild.id}
  **Room:** ${(message.channel as TextChannel).name} - ${message.channel.id}
  **User:** ${message.author.username} - ${message.author.id}
  **Command used:** ${message.content}
  **Error:** ${errorObject.message}\n
  **${errorObject.stack}**\n
  <@258993932262834188>`

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
        log: errorMessage
    });

    if (errorMessage.length > 2000) {
        errorMessage = `An Error occurred on ${currentTime}\nCheck console for full error (2000 character limit)\n<@258993932262834188>`
        return console.log(errorObject);
    }

    // Chooses channel to send error to
    // The list below are channels that are actively used for testing purposes
    if (["655484859405303809", "551588329003548683", "922679249058553857"].includes(message.channel.id)) {
        channel = message.channel
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
    myHeaders.append('User-Agent', 'hifumi-js:v1.0.0:tiltedtoast27@gmail.com');

    // Pixiv requires a Referrer header, no idea why
    if (url.includes("pximg")) {
        myHeaders.append('Referer', 'https://www.pixiv.net/');
    }

    const requestOptions: Object = {
        method: 'GET',
        headers: myHeaders,
        redirect: 'follow'
    }

    // Fetches the file from the URL and saves it to the file path
    await fetch(url, requestOptions)
        .then(response => response.arrayBuffer())
        .then(buffer => fsPromise.writeFile(absSaveLocation, new Uint8Array(buffer)))
        .catch(error => console.log('error', error));
}


/**
 * Takes an image URL and returns the file extension
 * @param {String} url The URL to whatever image you want to get the extension of
 * @returns {String} The file extension of the image
 */
export function getImgType(url: string): string {
    if (url.includes(".png") || url.includes(".webp")) {
        return "png";
    } else if (url.includes(".jpeg") || (url.includes(".jpg"))) {
        return "jpeg";
    } else if (url.includes(".gif")) {
        return "gif";
    } else if (url.includes(".svg")) {
        return "svg";
    } else {
        return "unknown";
    }
}

/**
 * Takes a numer and turns rounds it into an Integer or Float
 * @param {Number} x The number you want to round 
 * @returns {Number} The rounded number
 */
export function advRound(x: number): number {
    if (Math.floor(x / 1) + (x % 1) === parseInt(x.toString())) {
        return parseInt(x.toString());
    } else {
        return parseFloat(x.toString());
    }
}

/**
 * Takes the raw string of a discord Emoji and either returns the ID or the url
 * @param {String} emojiString The emoji string
 * @param {Boolean} id Whether or not you only want the ID or the URL
 * @returns {String} The ID or URL of the emoji
 */
export function extractEmoji(emojiString: string, id: boolean = false): string {
    const emojiID = emojiString.split(":")[2].slice(0, -1)

    if (id) {
        return emojiID;
    }

    if (emojiString[1] === "a") {
        return `https://cdn.discordapp.com/emojis/${emojiID}.gif`;
    } else {
        return `https://cdn.discordapp.com/emojis/${emojiID}.png`;
    }
}


/**
 * Takes a directory, checks whether it exists. If it does, it deletes it and recreates it. If it doesn't, it creates it
 * @param {String} directory Path to the temporary directory you want to create
 */
export function createTemp(directory: string) {
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