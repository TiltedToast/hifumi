import * as fsPromise from "fs/promises";
import * as fs from "fs";
import { FormData } from "formdata-node";
import fetch from "node-fetch";
import * as tools from "./tools.js";
import { Message, MessageAttachment } from "discord.js";
import { Headers } from "node-fetch";
import { ImgurResult } from "./interfaces.js";
import * as qrcode from "qrcode";
import { exec } from "child_process";
import { promisify } from "util";
import { IMGUR_CLIENT_ID } from "./config.js";

import sharp from "sharp";
import canvas from "canvas";
import axios from "axios";

const execPromise = promisify(exec);

export async function beautiful(message: Message): Promise<Message | undefined> {
    tools.createTemp("temp");
    const content = message.content.split(" ");

    // Checks for invalid User ID
    if (content.length === 2) {
        const pingOrIdString = content[1];
        if (isNaN(parseInt(pingOrIdString)) && !pingOrIdString.startsWith("<@")) {
            return await message.channel.send("Invalid ID! Use numbers only please");
        }
    }

    const user = content.length === 1 ? message.author : await tools.getUserObjectPingId(message);

    if (!user)
        return await message.channel.send(
            "Couldn't find the specified User, Discord may be having issues with their API"
        );
    // Downloads User Avatar and resizes it to the size required (180x180)
    const avatarURL = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=4096`;

    const fetchErrorMsg = await tools.downloadURL(avatarURL, `./temp/avatar.png`);
    if (fetchErrorMsg) return await message.channel.send(fetchErrorMsg);

    await resize("./temp/avatar.png", 180, "./temp/avatar_resized.png");

    // Creates a canvas and adds avatar as well as the background to it
    const beautifulCanvas = new canvas.Canvas(640, 674);
    const ctx = beautifulCanvas.getContext("2d");

    await canvas.loadImage("./temp/avatar_resized.png").then((img) => {
        ctx.drawImage(img, 422, 35);
    });

    await canvas.loadImage("./temp/avatar_resized.png").then((img) => {
        ctx.drawImage(img, 430, 377);
    });

    await canvas.loadImage("./src/files/background.png").then((img) => {
        ctx.drawImage(img, 0, 0);
    });

    // Saves the output buffer to a file and sends it to the channel
    const buffer = beautifulCanvas.toBuffer("image/png");
    fs.writeFileSync("./temp/beautiful.png", buffer);

    return await message.channel.send({ files: ["./temp/beautiful.png"] });
}

export async function qrCode(message: Message): Promise<Message> {
    const content = message.content.split(" ");
    if (content.length === 1) return await message.channel.send("Missing argument!");

    tools.createTemp("temp");

    const qrText = content.slice(1).join(" ");
    try {
        await qrcode.toFile("./temp/qr.png", qrText);
    } catch (err) {
        return await message.channel.send("Data too big to fit into a QR code!");
    }
    return await message.channel.send({ files: ["./temp/qr.png"] });
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

async function resizeGif(fileLocation: string, width: number, saveLocation: string): Promise<void> {
    await execPromise(`gifsicle --resize-width ${width} ${fileLocation} > ${saveLocation}`);
}

export async function resizeImg(message: Message, prefix: string): Promise<Message> {
    tools.createTemp("temp");
    const content = message.content.split(" ");

    // Checks for invalid User input
    if (!(content.length === 3) && message.attachments.size === 0) {
        return await message.channel.send(`Usage: \`${prefix}resize <width> <url>\``);
    } else if (content.length === 1 && message.attachments.size > 0) {
        return await message.channel.send("You have to provide the width!");
    }

    const width = parseInt(content[1]);
    const source = message.attachments.size > 0 ? (message.attachments.first() as MessageAttachment).url : content[2];

    if (!source) return await message.channel.send("Invalid URL!");

    const urlPattern = new RegExp(/https?:\/\/.*\.(?:jpg|jpeg|png|webp|avif|gif|svg|tiff)/i);
    const isValidURL = urlPattern.test(source);

    tools.createTemp("temp");

    // Matches URL against a regex pattern and invalidates gif files (they are not supported yet)
    if (!isValidURL) return await message.channel.send("Invalid source url!");

    // Downloads the image and resizes it
    // Sends the resized image to the channel if it's within the size limit
    const imgType = !source.includes("gif") ? tools.getImgType(source) : "gif";
    if (imgType === "unknown") return await message.channel.send("Invalid image type!");

    const fetchErrorMsg = await tools.downloadURL(source, `./temp/unknown.${imgType}`);
    if (fetchErrorMsg) return await message.channel.send(fetchErrorMsg);

    if (imgType === "gif") {
        await resizeGif(`./temp/unknown.${imgType}`, width, `./temp/unknown_resized.${imgType}`);
    } else {
        await resize(`./temp/unknown.${imgType}`, width, `./temp/unknown_resized.${imgType}`);
    }

    if (!tools.isValidSize(`./temp/unknown_resized.${imgType}`, 8192000)) {
        return await message.channel.send("File too large for Discord!");
    }

    return await message.channel.send({ files: [`./temp/unknown_resized.${imgType}`] });
}

export async function imgur(message: Message, prefix: string, url?: string): Promise<Message | undefined> {
    const content = message.content.split(" ");
    let source;
    if (url) {
        source = url;
    } else if (content.length !== 2 && message.attachments.size === 0) {
        return await message.channel.send(`Usage: \`${prefix}imgur <url>\``);
    } else {
        source = message.attachments.size > 0 ? (message.attachments.first() as MessageAttachment).url : content[1];
    }

    if (source === undefined) return await message.channel.send("Invalid URL!");

    const urlPattern = new RegExp(/https?:\/\/.*\.(?:png|jpg|jpeg|webp|gif)/i);
    const isValidURL = urlPattern.test(source);

    // Matches URL against a regex pattern
    if (!isValidURL) return await message.channel.send("Invalid source url!");

    // Imgur API doesn't support webp images
    if (source.includes("webp")) {
        source = source.replace("webp", "png");
    }

    tools.createTemp("temp");
    const imgType = tools.getImgType(source);
    if (imgType === "unknown") return await message.channel.send("Invalid image type!");
    const myHeaders = new Headers();
    const formdata = new FormData();
    myHeaders.append("Authorization", `Client-ID ${IMGUR_CLIENT_ID}`);

    const requestOptions: Record<string, unknown> = {
        method: "POST",
        headers: myHeaders,
        body: formdata,
        redirect: "follow",
    };

    // Checks for valid image size via Content-Length header if possible
    // If present, uploads the image to Imgur and sends the link to the channel if it's within the size limit (10MB)
    // If not, downloads the image and checks for valid size before uploading to Imgur
    const response = await axios.get(source, { headers: { Referer: "https://www.pixiv.net/" } });
    if (!response.headers["content-length"]) {
        const fetchErrorMsg = await tools.downloadURL(source, `./temp/unknown.${imgType}`);
        if (fetchErrorMsg) return await message.channel.send(fetchErrorMsg);

        if (!tools.isValidSize(`./temp/unknown.${imgType}`, 10240000)) {
            return await message.channel.send("File too large for Imgur! (10MB limit)");
        }

        const contents = await fsPromise.readFile(`./temp/unknown.${imgType}`, "base64");

        formdata.append("image", contents);

        const response = await fetch("https://api.imgur.com/3/image", requestOptions);
        if (!response.ok) return message.channel.send("An unknown error occured while uploading!");

        const result = await response.json();
        const imageLink = (result as ImgurResult)["data"]["link"];
        return await message.channel.send(imageLink);
    } else if (parseInt(response.headers["content-length"]) <= 10240000) {
        formdata.append("image", source);

        const response = await fetch("https://api.imgur.com/3/image", requestOptions);
        if (!response.ok) return message.channel.send("An unknown error occured while uploading!");

        const result = await response.json();
        const imageLink = (result as ImgurResult)["data"]["link"];
        return await message.channel.send(imageLink);
    } else {
        return await message.channel.send("File too large for Imgur! (10MB limit)");
    }
}
