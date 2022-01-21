import * as tools from './tools.js';

export async function addEmoji(interaction) {
    const name = interaction.options.getString('name');
    const source = interaction.options.getString('source');
    
    if (name.length < 2 || name.length > 32) {
        interaction.reply('The name must be between 2 and 32 characters long.');
        return;
    }
    const urlPattern = /https?:\/\/.*\.(?:png|jpg|jpeg|webp|gif)/i;

    if (source.match(urlPattern) === null && !source.startsWith('<')) {
        interaction.reply('Invalid source url!');
        return;
    } else if (source.startsWith('<')) {
        url = tools.extractEmoji(source);
    } else if (source.match(urlPattern).length === 1) {
        url = source.match(urlPattern)[0];
    }  
    
    if (url.includes('pximg')) {interaction.reply('Pixiv urls don\'t work yet, try uploading it to imgur first!'); return;}

    const emoji = await interaction.guild.emojis.create(url, name);

    if (emoji && emoji.animated) {
        interaction.reply(`Emoji added! <a:${emoji.name}:${emoji.id}>`);
    } else if (emoji && !emoji.animated) {
        interaction.reply(`Emoji added! <:${emoji.name}:${emoji.id}>`);
    }
}

export async function removeEmoji(interaction) {
    const emojiString = interaction.options.getString('emoji');

    try {
        const emojiID = tools.extractEmoji(emojiString, true);
        const emojis = interaction.guild.emojis.cache
        const emoji = emojis.find(emoji => emoji.id === emojiID);

        if (emoji) {
            emoji.delete();
            interaction.reply(`Emoji successfully deleted!`);
        } else {
            interaction.reply(`Emoji not found!`);
        }
    } catch (TypeError) {interaction.reply('Invalid emoji!'); return;}
}


export async function renameEmoji(interaction) {
    const emojiString = interaction.options.getString('emoji');

    try {
        const newName = interaction.options.getString('newname');

        const emojiID = tools.extractEmoji(emojiString, true);
        const emojis = interaction.guild.emojis.cache
        const emoji = emojis.find(emoji => emoji.id === emojiID);

        if (emoji) {
            const oldName = emoji.name;
            interaction.guild.emojis.fetch(emojiID).then(emoji => {emoji.edit({name: newName})});
            interaction.reply(`Emoji successfully renamed from ${oldName} to ${newName}!`);
        } else {
            interaction.reply(`Emoji not found!`);
        }
    } catch (TypeError) {interaction.reply('Invalid emoji!'); return;}
}