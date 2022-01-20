const tools = require('./tools.js');
const { imgurClientId, imgurClientSecret } = require('./config.json');
const https = require('https');
const embedColour = '0xce3a9b';

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
        url = url
    } else {
        url = interaction.options.getString('url');
    }
    if (!url.includes('http')) {
        interaction.reply('Invalid url!');
        return;
    }

    if (url.includes('webp')) {
        url = url.replace('webp', 'png');
    }
    const options = {
        hostname: 'api.imgur.com',
        port: 443,
        path: '/3/upload',
        method: 'POST',
        headers: {'Authorization': `Client-ID ${imgurClientId}`},
        body: {'image': url, 'type': 'URL'}
        };

    https.request(options, (res) => {
        console.log(`statusCode: ${res.statusCode}`);
        res.on('data', (d) => {
            console.log(d);
        });
            
        res.on('error', (e) => {
            console.log(e);
        });
        
    })
}


module.exports = {
    beautiful,
    resize,
    resizeImg,
    resizeGif,
    imgur

}