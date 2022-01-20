const tools = require('./tools.js');
const { imgurClientId, imgurClientSecret } = require('./config.json');
const https = require('https');

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
    } else {
        const options = {
            hostname: 'api.imgur.com',
            path: '/3/image',
            method: 'POST',
            headers: `${imgurClientId} ${imgurClientSecret}`
        };

        const r = https.request(options, (res) => {
            res.on('data', (d) => {
                const json = JSON.parse(d);
                interaction.reply(`https://imgur.com/${json.data.id}`);
            });

        })
        console.log(r);
        r.on('error', (e) => {
            console.error(e);
            interaction.reply('An unknown error has occurred!');
        }
    )}
}


module.exports = {
    beautiful,
    resize,
    resizeImg,
    resizeGif,
    imgur

}