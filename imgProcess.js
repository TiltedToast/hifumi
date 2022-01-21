const tools = require('./tools.js');
const { imgurClientId, imgurClientSecret } = require('./config.json');
const https = require('https');
const embedColour = '0xce3a9b';
const FormData = require('form-data');
const Headers = require('node-fetch').Headers;
const fetch = require('node-fetch');

async function beautiful(interaction) {

}

async function resize(fileLocation, width, saveLocation) {

}

async function resizeImg(interaction, url=null, imgWidth=null) {

}

async function resizeGif(fileLocation) {

}

async function imgur(interaction, url=null) {
    if (url) {
        source = url
    } else {
        source = interaction.options.getString('url');
    }

    const urlPattern = /https?:\/\/.*\.(?:png|jpg|jpeg|webp|gif)/i;

    if (source.match(urlPattern) === null) {
        interaction.reply('Invalid source url!');
        return;
    } else if (source.match(urlPattern).length === 1) {
        url = source.match(urlPattern)[0];
    }

    interaction.reply('Uploading...');

    if (url.includes('webp')) {
        url = url.replace('webp', 'png');
    }

    const formData = new FormData();
    formData.append('image', url);
    formData.append('type', 'url');
    
    const myHeaders = new Headers();
    myHeaders.append("Authorization", `Client-ID ${imgurClientId}`);


    const  formdata = new FormData();
    formdata.append("image", url);

    const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: formdata,
        redirect: 'follow'
    };

    fetch("https://api.imgur.com/3/image", requestOptions)
    .then(response => response.text())
    .then(result => {const data = JSON.parse(result); interaction.editReply(data['data']['link'])})
    .catch(error => console.log('error', error));
}


module.exports = {
    beautiful,
    resize,
    resizeImg,
    resizeGif,
    imgur

}