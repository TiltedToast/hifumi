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
import 'canvas';
import { client } from './app.js';
// import 'canvas-constructor/cairo';

export async function beautiful(interaction) {
    await interaction.deferReply()
    const optionsArray = tools.getOptionsArray(interaction.options.data);
    tools.createTemp('temp');
    let user = undefined;
    try {
		if (optionsArray.length === 0) {
			user = interaction.user;
	
		} else if (optionsArray.includes("user") && !optionsArray.includes("userid")) {
			user = interaction.options.getUser('user');
	
		} else if (optionsArray.includes("userid") && !optionsArray.includes("user")) {
			user = await client.users.fetch(interaction.options.getString('userid'));
	
		} else if (optionsArray.includes("user") && optionsArray.includes("userid")) {
			user = interaction.options.getUser('user');
		}
	} catch (DiscordAPIError) {
		return interaction.editReply('User not found!');
	}


    const avatarURL = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=4096`
    await tools.downloadURL(avatarURL, `./temp/avatar.png`);
    await resize('./temp/avatar.png', 180, './temp/avatar_resized.png');

    const beautifulCanvas = new canvas.Canvas(640, 674);
    const ctx = beautifulCanvas.getContext('2d')

    await canvas.loadImage('./temp/avatar_resized.png')
    .then(img => {ctx.drawImage(img, 422, 35)});

    await canvas.loadImage('./temp/avatar_resized.png')
    .then(img => {ctx.drawImage(img, 430, 377)});
    

    await canvas.loadImage('./files/background.png')
    .then(img => {ctx.drawImage(img, 0, 0)});


    const buffer = beautifulCanvas.toBuffer('image/png');
    fs.writeFileSync('./temp/beautiful.png', buffer);

    interaction.editReply({files: ['./temp/beautiful.png']});

}


export async function resize(fileLocation, width, saveLocation) {  
    sharp.cache(false); 
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
