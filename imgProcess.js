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
    const formData = new FormData();
    formData.append('image', url);
    formData.append('type', 'url');
    
    // const options = {
    //     hostname: 'api.imgur.com',
    //     path: '/3/upload',
    //     method: 'POST',
    //     headers: {'Authorization': `Client-ID ${imgurClientId}`},
    //     body: formData
    // };

    // https.request(options, (res) => {
    //     console.log(`statusCode: ${res.statusCode}`);
    //     let data = '';
    //     res.on('data', (d) => {
    //         console.log(d);
    //         data += d;
    //     });

    //     res.on('end', () => {
    //         const json = JSON.parse(data);
    //         console.log(json);
    //         interaction.reply('Image uploaded!');
    //     });
            
    //     res.on('error', (e) => {
    //         console.log(e);
    //     });     
    // })
    const myHeaders = new Headers();
    myHeaders.append("Authorization", `Client-ID ${imgurClientId}`);

    if (url.includes('pximg')) {
        interaction.reply("Pixiv Images are unfortunately not supported");
        return;
    }

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
    .then(result => {const data = JSON.parse(result); interaction.reply(data['data']['link'])})
    .catch(error => console.log('error', error));
}


module.exports = {
    beautiful,
    resize,
    resizeImg,
    resizeGif,
    imgur

}