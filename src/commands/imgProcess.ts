import canvas from "canvas";
import type { Message } from "discord.js";
import * as fsPromise from "node:fs/promises";
import fetch, { Headers, RequestInit } from "node-fetch";
import * as qrcode from "qrcode";
import { IMGUR_CLIENT_ID } from "../config.js";
import {
    FileSizeLimit,
    ImgurParams,
    ImgurResponse,
    ImgurResponseSchema,
} from "../helpers/types.js";
import {
    createTemp,
    downloadURL,
    getImgType,
    getUserObjectPingId,
    isValidSize,
    resize,
} from "../helpers/utils.js";

export async function beautiful(message: Message) {
    createTemp("temp");
    const content = message.content.split(" ");

    const user = content.length === 1 ? message.author : await getUserObjectPingId(message);
    if (!user) return await message.channel.send("Couldn't find the specified User");

    // Downloads User Avatar and resizes it to the size required (180x180)
    const avatarURL = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=4096`;

    const fetchErrorMsg = await downloadURL(avatarURL, `./temp/avatar.png`);
    if (fetchErrorMsg) return await message.channel.send(fetchErrorMsg);

    await resize({
        fileLocation: "./temp/avatar.png",
        width: 180,
        saveLocation: "./temp/avatar_resized.png",
    });

    // Creates a canvas and adds avatar as well as the background to it
    const beautifulCanvas = new canvas.Canvas(640, 674);
    const ctx = beautifulCanvas.getContext("2d");
    const avatar = await canvas.loadImage("./temp/avatar_resized.png");
    const background = await canvas.loadImage("./src/assets/beautiful_background.png");

    // Top pfp
    ctx.drawImage(avatar, 422, 35);
    // Bottom pfp
    ctx.drawImage(avatar, 430, 377);
    // Background
    ctx.drawImage(background, 0, 0);

    // Saves the output buffer to a file and sends it to the channel
    const buffer = beautifulCanvas.toBuffer("image/png");
    await fsPromise.writeFile("./temp/beautiful.png", buffer);

    return await message.channel.send({ files: ["./temp/beautiful.png"] });
}

export async function qrCode(message: Message) {
    const content = message.content.split(" ");
    if (content.length === 1) return await message.channel.send("Missing argument!");

    createTemp("temp");

    const qrText = content.slice(1).join(" ");
    try {
        await qrcode.toFile("./temp/qr.png", qrText);
    } catch (err) {
        return await message.channel.send("Data too big to fit into a QR code!");
    }
    return await message.channel.send({ files: ["./temp/qr.png"] });
}

export async function resizeImg(message: Message, prefix: string) {
    createTemp("temp");
    const content = message.content.split(" ");

    // Checks for invalid User input
    if (content.length !== 3 && message.attachments.size === 0) {
        return await message.channel.send(`Usage: \`${prefix}resize <width> <url>\``);
    } else if (content.length === 1 && message.attachments.size > 0) {
        return await message.channel.send("You have to provide the width!");
    }

    const width = parseInt(content[1]);
    const source = message.attachments.size > 0 ? message.attachments.first()?.url : content[2];

    if (!source) return await message.channel.send("Invalid URL!");

    const urlPattern = new RegExp(/https?:\/\/.*\.(?:jpg|jpeg|png|webp|avif|gif|svg|tiff)/i);
    const isValidURL = urlPattern.test(source);

    createTemp("temp");

    // Matches URL against a regex pattern and invalidates gif files (they are not supported yet)
    if (!isValidURL) return await message.channel.send("Invalid source url!");

    // Downloads the image and resizes it
    // Sends the resized image to the channel if it's within the size limit
    const imgType = getImgType(source);
    if (!imgType) return await message.channel.send("Invalid image type!");

    const fetchErrorMsg = await downloadURL(source, `./temp/unknown.${imgType}`);
    if (fetchErrorMsg) return await message.channel.send(fetchErrorMsg);

    await resize({
        fileLocation: `./temp/unknown.${imgType}`,
        width,
        saveLocation: `./temp/unknown_resized.${imgType}`,
    });

    if (!isValidSize(`./temp/unknown_resized.${imgType}`, FileSizeLimit.DiscordFile)) {
        return await message.channel.send("File too large for Discord!");
    }

    return await message.channel.send({ files: [`./temp/unknown_resized.${imgType}`] });
}

export async function imgur(args: ImgurParams) {
    const { message, prefix, url } = args;
    const content = message.content.split(" ");
    if (content.length !== 2 && message.attachments.size === 0) {
        return await message.channel.send(`Usage: \`${prefix}imgur <url>\``);
    }

    let source = message.attachments.size > 0 ? message.attachments.first()?.url : content[1];
    if (url) source = url;

    if (!source) return await message.channel.send("Invalid URL!");

    const urlPattern = new RegExp(/https?:\/\/.*\.(?:png|jpg|jpeg|webp|gif)/i);
    const isValidURL = urlPattern.test(source);

    // Matches URL against a regex pattern
    if (!isValidURL) return await message.channel.send("Invalid source url!");

    // Imgur API doesn't support webp images
    if (source.includes(".webp")) {
        source = source.replace(".webp", ".png");
    }

    createTemp("temp");

    const imgType = getImgType(source);
    if (imgType === null) return await message.channel.send("Invalid image type!");

    const myHeaders = new Headers();
    const formdata = new FormData();
    myHeaders.append("Authorization", `Client-ID ${IMGUR_CLIENT_ID}`);

    const requestOptions: RequestInit = {
        method: "POST",
        headers: myHeaders,
        body: formdata,
        redirect: "follow",
    };

    // Checks for valid image size via Content-Length header if possible
    // If present, uploads the image to Imgur and sends the link to the channel if it's within the size limit (10MB)
    // If not, downloads the image and checks for valid size before uploading to Imgur
    const response = await fetch(source, {
        headers: source.includes("pximg") ? { Referer: "https://www.pixiv.net/" } : undefined,
    });
    const contentLength = response.headers.get("Content-Length");

    if (!response.headers.has("Content-Length")) {
        const fetchErrorMsg = await downloadURL(source, `./temp/unknown.${imgType}`);
        if (fetchErrorMsg) return await message.channel.send(fetchErrorMsg);

        if (!isValidSize(`./temp/unknown.${imgType}`, FileSizeLimit.ImgurFile)) {
            return await message.channel.send("File too large for Imgur! (10MB limit)");
        }

        const contents = await fsPromise.readFile(`./temp/unknown.${imgType}`, "base64");

        formdata.append("image", contents);

        const response = await fetch("https://api.imgur.com/3/image", requestOptions);
        const result = (await response.json()) as ImgurResponse;

        if (!response.ok)
            return message.channel.send(`Failed to upload image: ${result.data.error?.message}`);

        if (!ImgurResponseSchema.safeParse(result).success) {
            return await message.channel.send(
                "Something went wrong with the API, maybe try again later"
            );
        }

        return await message.channel.send(result.data.link);
    } else if (contentLength !== null && parseInt(contentLength) <= FileSizeLimit.ImgurFile) {
        formdata.append("image", source);

        const response = await fetch("https://api.imgur.com/3/image", requestOptions);
        const result = (await response.json()) as ImgurResponse;

        if (!response.ok)
            return message.channel.send(`Failed to upload image: ${result.data.error?.message}`);

        if (!ImgurResponseSchema.safeParse(result).success) {
            return await message.channel.send(
                "Something went wrong with the API, maybe try again later"
            );
        }

        return await message.channel.send(result.data.link);
    }
    return await message.channel.send("File too large for Imgur! (10MB limit)");
}
