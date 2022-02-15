import * as fsPromise from 'fs/promises';
import * as fs from 'fs';
import { FormData } from "formdata-node"
import fetch from 'node-fetch';
import * as tools from './tools.js';
import { credentials } from './config.js';
import { MessageEmbed } from 'discord.js';
import { Headers } from 'node-fetch';
import sharp from 'sharp';
import canvas from 'canvas';
import { client } from './app.js';
import axios from 'axios';


export async function beautiful(message) {
    tools.createTemp('temp');

    // const user = await tools.getUserFromUserAndId(client, interaction, optionsArray, 'user', 'userid');
    const pingId = message.content.split(" ")[1]
    if (isNaN(pingId) && (!pingId.startsWith("<@"))) {
        return await message.channel.send("Invalid ID! Use numbers only please");
    }

    const user = await tools.getUserObjectPingId(message);


    const avatarURL = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=4096`
    await tools.downloadURL(avatarURL, `./temp/avatar.png`);
    await resize('./temp/avatar.png', 180, './temp/avatar_resized.png');

    const beautifulCanvas = new canvas.Canvas(640, 674);
    const ctx = beautifulCanvas.getContext('2d')

    await canvas.loadImage('./temp/avatar_resized.png')
        .then(img => { ctx.drawImage(img, 422, 35) });

    await canvas.loadImage('./temp/avatar_resized.png')
        .then(img => { ctx.drawImage(img, 430, 377) });


    await canvas.loadImage('./files/background.png')
        .then(img => { ctx.drawImage(img, 0, 0) });


    const buffer = beautifulCanvas.toBuffer('image/png');
    fs.writeFileSync('./temp/beautiful.png', buffer);

    await message.channel.send({ files: ['./temp/beautiful.png'] });
}


export async function resize(fileLocation, width, saveLocation) {
    sharp.cache(false);
    await sharp(fileLocation).resize(width).toFile(saveLocation);
}


export async function resizeImg(message, prefix) {
    // const source = interaction.options.getString('url');
    // const width = interaction.options.getInteger('width');
    tools.createTemp('temp');
    const content = message.content.split(" ");

    if (!content.length === 3 && message.attachments.size === 0) {
        return await message.channel.send(`Usage: \`${prefix}resize <width> <url>\``);
    } else if (content.length === 1 && message.attachments.size > 0) {
        return await message.channel.send("You have to provide the width!");
    }

    const width = parseInt(content[1]);
    const source = message.attachments.size > 0 ? message.attachments.first().url : content[2];

    const urlPattern = /https?:\/\/.*\.(?:jpg|jpeg|png|webp|avif|gif|svg|tiff)/i;

    tools.createTemp('temp');

    let url = '';

    if (source.match(urlPattern) === null) {
        return await message.channel.send('Invalid source url!');
    } else if (source.match(urlPattern).length === 1) {
        url += source.match(urlPattern)[0];
    } else if (url.includes(".gif")) {
        return await message.channel.send('Gifs are not supported!');
    }

    const imgType = tools.getImgType(url);
    await tools.downloadURL(url, `./temp/unknown.${imgType}`);
    await resize(`./temp/unknown.${imgType}`, width, `./temp/unknown_resized.${imgType}`);

    if (!tools.isValidSize(`./temp/unknown_resized.${imgType}`, 8000000)) {
        return await message.channel.send('File too large for Discord!');
    }

    await message.channel.send({ files: [`./temp/unknown_resized.${imgType}`] });
}


export async function imgur(message, prefix, url = null) {
    const content = message.content.split(" ");
    let source;
    if (url) {
        source = url
    } else if (!content.length !== 2 && message.attachments.size === 0) {
        return await message.channel.send(`Usage: \`${prefix}imgur <url>\``);
    } else {
        source = message.attachments.size > 0 ? message.attachments.first().url : content[1];
    }

    const urlPattern = /https?:\/\/.*\.(?:png|jpg|jpeg|webp|gif)/i;

    if (source.match(urlPattern) === null) {
        return await message.channel.send('Invalid source url!');
    } else if (source.match(urlPattern).length === 1) {
        url = source.match(urlPattern)[0];
    }

    if (url.includes('webp')) {
        url = url.replace('webp', 'png');
    }

    tools.createTemp('temp');
    const imgType = tools.getImgType(url);
    const myHeaders = new Headers();
    const formdata = new FormData();
    myHeaders.append("Authorization", `Client-ID ${credentials['imgurClientId']}`);

    const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: formdata,
        redirect: 'follow'
    }

    const response = await axios.get(url, { headers: { "Referer": "https://www.pixiv.net/" } });
    if (!response.headers["content-length"]) {
        await tools.downloadURL(url, `./temp/unknown.${imgType}`);

        if (!tools.isValidSize(`./temp/unknown.${imgType}`, 10000000)) {
            return await message.channel.send('File too large for Imgur! (10MB limit)');
        }

        const contents = await fsPromise.readFile(`./temp/unknown.${imgType}`, 'base64');

        formdata.append("image", contents);

        fetch("https://api.imgur.com/3/image", requestOptions)
            .then(response => response.json())
            .then(result => {
                const imageLink = result['data']['link'];
                 message.channel.send(imageLink);
            })
            .catch(() => { return message.channel.send("An unknown error occured while uploading!") });

    } else if (response.headers["content-length"] <= 10000000) {
        formdata.append("image", url);

        fetch("https://api.imgur.com/3/image", requestOptions)
            .then(response => response.json())
            .then(result => {
                const imageLink = result['data']['link'];
                message.channel.send(imageLink);
            })
            .catch(() => { return message.channel.send("An unknown error occured while uploading!") });
    } else {
        return await message.channel.send('File too large for Imgur! (10MB limit)');
    }
}