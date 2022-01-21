import sharp from 'sharp';
import * as fs from 'fs';
import { FormData } from "formdata-node"
import fetch from 'node-fetch';
import * as tools from './tools.js';
import { credentials } from './config.js';
import { MessageAttachment, MessageEmbed } from 'discord.js';
import { Headers } from 'node-fetch';


export async function beautiful(interaction) {

}

export async function resize(fileLocation, width, saveLocation) {
    await sharp(fileLocation).resize({width: width}).toFile(saveLocation);
}

export async function resizeImg(interaction) {
    const source = interaction.options.getString('url');
    const width = interaction.options.getInteger('width');
    const urlPattern = /https?:\/\/.*\.(?:jpg|jpeg|png|webp|avif|gif|svg|tiff)/i;
    // interaction.deferReply();

    let url = '';

    if (source.match(urlPattern) === null) {
        interaction.editReply('Invalid source url!');
        return;
    } else if (source.match(urlPattern).length === 1) {
        url += source.match(urlPattern)[0];
    }

    console.log(url);
    const imgType = tools.getImgType(url);
    tools.downloadURL(url, `./files/unknown.${imgType}`);
    await resize(`./files/unknown.${imgType}`, width, `./files/unknown_resized.${imgType}`);

    const resizeAttachment = new MessageAttachment(`./files/unknown_resized.${imgType}`);
    interaction.reply({attachments: [resizeAttachment]});
}

export async function resizeGif(fileLocation) {

}

export async function imgur(interaction, url=null) {
    let source = '';
    if (url) {
        source += url
    } else {
        source += interaction.options.getString('url');
    }
    interaction.deferReply();
    const urlPattern = /https?:\/\/.*\.(?:png|jpg|jpeg|webp|gif)/i;

    if (source.match(urlPattern) === null) {
        interaction.reply('Invalid source url!');
        return;
    } else if (source.match(urlPattern).length === 1) {
        url = source.match(urlPattern)[0];
    }


    if (url.includes('webp')) {
        url = url.replace('webp', 'png');
    }
    
    const myHeaders = new Headers();
    myHeaders.append("Authorization", `Client-ID ${credentials['imgurClientId']}`);

    const formdata = new FormData();
    formdata.append("image", url);

    const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: formdata,
        redirect: 'follow'
    };

    fetch("https://api.imgur.com/3/image", requestOptions)
    .then(response => response.text())
    .then(result => {const data = JSON.parse(result); interaction.editReply(data['data']['link']); return data['data']['link'];})
    .catch(error => console.log('error', error));
    
}
