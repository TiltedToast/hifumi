import * as fsPromise from 'fs/promises';
import * as fs from 'fs';
import { FormData } from "formdata-node"
import fetch from 'node-fetch';
import * as tools from './tools.js';
import { credentials } from './config.js';
import { Message, MessageAttachment, MessageEmbed } from 'discord.js';
import { Headers } from 'node-fetch';
import sharp from 'sharp';
import canvas from 'canvas';
import { client } from './app.js';
import axios from 'axios';


export async function beautiful(message: Message): Promise<any> {
    tools.createTemp('temp');

    // Checks for invalid User ID 
    const pingId = message.content.split(" ")[1]
    if (isNaN(parseInt(pingId)) && (!pingId.startsWith("<@"))) {
        return await message.channel.send("Invalid ID! Use numbers only please");
    }

    const user = await tools.getUserObjectPingId(message);
    if (user === undefined) return;
    // Downloads User Avatar and resizes it to the size required (180x180)
    const avatarURL = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=4096`
    await tools.downloadURL(avatarURL, `./temp/avatar.png`);
    await resize('./temp/avatar.png', 180, './temp/avatar_resized.png');

    // Creates a canvas and adds avatar as well as the backgrund to it
    const beautifulCanvas = new canvas.Canvas(640, 674);
    const ctx = beautifulCanvas.getContext('2d')

    await canvas.loadImage('./temp/avatar_resized.png')
        .then(img => { ctx.drawImage(img, 422, 35) });

    await canvas.loadImage('./temp/avatar_resized.png')
        .then(img => { ctx.drawImage(img, 430, 377) });


    await canvas.loadImage('./files/background.png')
        .then(img => { ctx.drawImage(img, 0, 0) });


    // Saves the output buffer to a file and sends it to the channel
    const buffer = beautifulCanvas.toBuffer('image/png');
    fs.writeFileSync('./temp/beautiful.png', buffer);

    return await message.channel.send({ files: ['./temp/beautiful.png'] });
}

/**
 * Resizes an image file using sharp
 * @param  {string} fileLocation The location of the image file to resize
 * @param  {number} width The desired width of the image
 * @param  {string} saveLocation The location to save the resized image
 */
export async function resize(fileLocation: string, width: number, saveLocation: string): Promise<void> {
    // Sharp has a tendency to cache the image, so we need to clear the cache first
    sharp.cache(false);
    await sharp(fileLocation).resize(width).toFile(saveLocation);
}


export async function resizeImg(message: Message, prefix: string): Promise<any> {
    tools.createTemp('temp');
    const content = message.content.split(" ");

    // Checks for invalid User input
    if (!(content.length === 3) && message.attachments.size === 0) {
        return await message.channel.send(`Usage: \`${prefix}resize <width> <url>\``);
    } else if (content.length === 1 && message.attachments.size > 0) {
        return await message.channel.send("You have to provide the width!");
    }

    const width = parseInt(content[1]);
    const source = message.attachments.size > 0 ? (message.attachments.first() as MessageAttachment).url : content[2];
    if (source === undefined) return await message.channel.send("Invalid URL!");
    const urlPattern = /https?:\/\/.*\.(?:jpg|jpeg|png|webp|avif|gif|svg|tiff)/i;

    tools.createTemp('temp');

    let url = '';

    // Matches URL against a regex pattern and invalidates gif files (they are not supported yet)
    // TODO - Add support for gif files
    if (source.match(urlPattern) === null) {
        return await message.channel.send('Invalid source url!');
    } else if ((source.match(urlPattern) as RegExpMatchArray).length === 1) {
        url += (source.match(urlPattern) as RegExpMatchArray)[0];
    } else if (url.includes(".gif")) {
        return await message.channel.send('Gifs are not supported!');
    }

    // Downloads the image and resizes it
    // Sends the resized image to the channel if it's within the size limit
    const imgType = tools.getImgType(url);
    if (imgType === "unknown") return await message.channel.send("Invalid image type!");
    await tools.downloadURL(url, `./temp/unknown.${imgType}`);
    await resize(`./temp/unknown.${imgType}`, width, `./temp/unknown_resized.${imgType}`);

    if (!tools.isValidSize(`./temp/unknown_resized.${imgType}`, 8192000)) {
        return await message.channel.send('File too large for Discord!');
    }

    await message.channel.send({ files: [`./temp/unknown_resized.${imgType}`] });
}


export async function imgur(message: Message, prefix: string, url?: string): Promise<any> {
    const content = message.content.split(" ");
    let source;
    if (url) {
        source = url
    } else if (!(content.length !== 2) && message.attachments.size === 0) {
        return await message.channel.send(`Usage: \`${prefix}imgur <url>\``);
    } else {
        source = message.attachments.size > 0 ? (message.attachments.first() as MessageAttachment).url : content[1];
    }

    if (source === undefined) return await message.channel.send("Invalid URL!");

    const urlPattern = /https?:\/\/.*\.(?:png|jpg|jpeg|webp|gif)/i;

    const matchedArray = source.match(urlPattern);
    // Matches URL against a regex pattern 
    if (matchedArray === null) {
        return await message.channel.send('Invalid source url!');
    } else if ((matchedArray as RegExpMatchArray).length === 1) {
        url = (matchedArray as RegExpMatchArray)[0];
    }

    if (url === undefined) return;
    
    // Imgur API doesn't support webp images 
    if (url.includes('webp')) {
        url = url.replace('webp', 'png');
    }

    tools.createTemp('temp');
    const imgType = tools.getImgType(url);
    if (imgType === "unknown") return await message.channel.send("Invalid image type!");
    const myHeaders = new Headers();
    const formdata = new FormData();
    myHeaders.append("Authorization", `Client-ID ${credentials['imgurClientId']}`);

    const requestOptions: any = {
        method: 'POST',
        headers: myHeaders,
        body: formdata,
        redirect: 'follow'
    }

    // Checks for valid image size via Content-Length header if possible
    // If present, uploads the image to Imgur and sends the link to the channel if it's within the size limit (10MB)
    // If not, downloads the image and checks for valid size before uploading to Imgur
    const response = await axios.get(url, { headers: { "Referer": "https://www.pixiv.net/" } });
    if (!response.headers["content-length"]) {
        await tools.downloadURL(url, `./temp/unknown.${imgType}`);

        if (!tools.isValidSize(`./temp/unknown.${imgType}`, 10240000)) {
            return await message.channel.send('File too large for Imgur! (10MB limit)');
        }

        const contents = await fsPromise.readFile(`./temp/unknown.${imgType}`, 'base64');

        formdata.append("image", contents);

        fetch("https://api.imgur.com/3/image", requestOptions)
            .then(response => response.json())
            .then(result => {
                const imageLink = (result as any)['data']['link'];
                message.channel.send(imageLink);
            })
            .catch(() => { return message.channel.send("An unknown error occured while uploading!") });

    } else if (parseInt(response.headers["content-length"]) <= 10240000) {
        formdata.append("image", url);

        fetch("https://api.imgur.com/3/image", requestOptions)
            .then(response => response.json())
            .then(result => {
                const imageLink = (result as any)['data']['link'];
                message.channel.send(imageLink);
            })
            .catch(() => { return message.channel.send("An unknown error occured while uploading!") });
    } else {
        return await message.channel.send('File too large for Imgur! (10MB limit)');
    }
}