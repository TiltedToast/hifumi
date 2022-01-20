const tools = require('./tools.js');

async function addEmoji(interaction) {
    const name = interaction.options.getString('name');
    const source = interaction.options.getString('source');
    
    if (name.length < 2 || name.length > 32) {
        interaction.reply('The name must be between 2 and 32 characters long.');
        return;
    }
    
    if (source.includes('http') && source.includes('<>')) {
        url = source.splice(1, -1);
    } else if (source.includes("http")) {
        url = source;
    } else if (source.startsWith('<')) {
        url = tools.extractEmoji(source);
    } else {
        interaction.reply('Invalid source url!');
        return;
    }

    const emoji = await interaction.guild.emojis.create(url, name);

    if (emoji && emoji.animated) {
        interaction.reply(`Emoji added! <a:${emoji.name}:${emoji.id}>`);
    } else if (emoji && !emoji.animated) {
        interaction.reply(`Emoji added! <:${emoji.name}:${emoji.id}>`);
    }
}

async function removeEmoji(interaction) {
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


async function renameEmoji(interaction) {
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


module.exports = {
    addEmoji, removeEmoji, renameEmoji
}