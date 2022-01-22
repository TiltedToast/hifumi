import * as fsPromise from 'fs/promises';
import * as fs from 'fs';
import { FormData } from "formdata-node"
import fetch from 'node-fetch';
import * as tools from './tools.js';
import { credentials } from './config.js';
import { MessageEmbed } from 'discord.js';
import { Headers } from 'node-fetch';
import sharp from 'sharp';
import { exec } from 'child_process';
import gifsicle from 'gifsicle';

export async function beautiful(interaction) {
}


export async function resize(fileLocation, width, saveLocation) {
    await sharp(fileLocation).resize(width).toFile(saveLocation);
}
    

export async function resizeImg(interaction) {
    const source = interaction.options.getString('url');
    const width = interaction.options.getInteger('width');
    const urlPattern = /https?:\/\/.*\.(?:jpg|jpeg|png|webp|avif|gif|svg|tiff)/i;
    await interaction.deferReply();
    tools.createTemp('temp');

    let url = '';

    if (source.match(urlPattern) === null) {
        return interaction.editReply('Invalid source url!');
    } else if (source.match(urlPattern).length === 1) {
        url += source.match(urlPattern)[0];
    }

    
    else if (url.includes(".gif")) {
        return interaction.editReply('Gifs are not supported!');
    }
    
    const imgType = tools.getImgType(url);
    await tools.downloadURL(url, `./temp/unknown.${imgType}`);
    await resize(`./temp/unknown.${imgType}`, width, `./temp/unknown_resized.${imgType}`);

    await fsPromise.stat(`./temp/unknown_resized.${imgType}`).then(stats => {
        if (stats.size > 8000000) {
            return interaction.editReply('File too large for Discord!');
        }
    });

    interaction.editReply({files: [`./temp/unknown_resized.${imgType}`]});
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
    await interaction.deferReply();
    const urlPattern = /https?:\/\/.*\.(?:png|jpg|jpeg|webp|gif)/i;

    if (source.match(urlPattern) === null) {
        return interaction.reply('Invalid source url!');
    } else if (source.match(urlPattern).length === 1) {
        url = source.match(urlPattern)[0];
    }

    if (url.includes('webp')) {
        url = url.replace('webp', 'png');
    }

    tools.createTemp('temp');
    const imgType = tools.getImgType(url);
    await tools.downloadURL(url, `./temp/unknown.${imgType}`);

    await fsPromise.stat(`./temp/unknown.${imgType}`).then(stats => {
        if (stats.size > 10000000) {
            return interaction.editReply('File too large for Imgur!');
        }
    });

    const contents = await fsPromise.readFile(`./temp/unknown.${imgType}`, 'base64');
    const myHeaders = new Headers();
    myHeaders.append("Authorization", `Client-ID ${credentials['imgurClientId']}`);

    const formdata = new FormData();
    formdata.append("image", contents);

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
