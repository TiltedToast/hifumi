import * as tools from './tools.js';
import { Permissions } from 'discord.js';
import * as imgProcess from './imgProcess.js';

export async function addEmoji(message, prefix) {
    if (!message.member.permissions.has(Permissions.FLAGS.MANAGE_EMOJIS_AND_STICKERS)) {
        return await message.channel.send('You need the "Manage Emojis" permission to add emojis!');
    }
    const content = message.content.split(' ');

    if (content.length === 2) {
        return await message.channel.send(`Usage: \`${prefix}emoji add <name> <url/emoji>\``);
    }

    let name;
    let emoji;
    let url;

    if (content[2].startsWith('<:') && content[2].includes('>')) {
        name = content[2].split(':')[1]
    } else {
        name = content[2];
    }

    if (content.length >= 4 && (name.length < 2 || name.length > 32)) {
        return message.channel.send('The name must be between 2 and 32 characters long.');
    }

    const source = content.length >= 4 ? content[3] : content[2];

    const urlPattern = /https?:\/\/.*\.(?:png|jpg|jpeg|webp|gif)/i;

    if (source.match(urlPattern) === null && !source.startsWith('<')) {
        return message.channel.send('Invalid source url!');
    } else if (source.startsWith('<:')) {
        url = tools.extractEmoji(source);
    } else if (source.match(urlPattern).length === 1) {
        url = source.match(urlPattern)[0];
    } else if (message.attachments.size > 0) {
        url = message.attachments.first().url;
    }

    tools.createTemp('temp');
    const imgType = tools.getImgType(url);
    await tools.downloadURL(url, `./temp/unknown.${imgType}`);

    if (!tools.isValidSize(`./temp/unknown.${imgType}`, 256000) && imgType === "gif") {
        return message.channel.send('Gif too large for Discord!');
    }

    if (!tools.isValidSize(`./temp/unknown.${imgType}`, 256000)) {
        await imgProcess.resize(`./temp/unknown.${imgType}`, 128, `./temp/unknown_resized.${imgType}`);

        if (!tools.isValidSize(`./temp/unknown_resized.${imgType}`, 256000)) {
            return message.channel.send('File too large for Discord, even after resizing!');
        }

        emoji = await message.guild.emojis.create(`./temp/unknown_resized.${imgType}`, name);
    } else if (tools.isValidSize(`./temp/unknown.${imgType}`, 256000)) {
        emoji = await message.guild.emojis.create(`./temp/unknown.${imgType}`, name);
    }

    if (emoji && emoji.animated) {
        message.channel.send(`Emoji added! <a:${emoji.name}:${emoji.id}>`);
    } else if (emoji && !emoji.animated) {
        message.channel.send(`Emoji added! <:${emoji.name}:${emoji.id}>`);
    }
}

export async function removeEmoji(message, prefix) {
    if (!message.member.permissions.has(Permissions.FLAGS.MANAGE_EMOJIS_AND_STICKERS)) {
        return message.channel.send('You need the "Manage Emojis" permission to remove emojis!');
    }

    const content = message.content.split(' ');

    try {
        if (!content.length === 3) {
            return await message.channel.send(`Usage: \`${prefix}emoji remove <emoji>\``);
        }
        const emojiString = content[2];
        const emojiID = tools.extractEmoji(emojiString, true);
        const emojis = message.guild.emojis.cache
        const emoji = emojis.find(emoji => emoji.id === emojiID);

        if (emoji) {
            emoji.delete();
            message.channel.send(`Emoji successfully deleted!`);
        } else {
            message.channel.send(`Emoji not found!`);
        }
    } catch (error) {
        return await message.channel.send(`Usage: \`${prefix}emoji remove <emoji>\``);
    }
}


export async function renameEmoji(message, prefix) {
    if (!message.member.permissions.has(Permissions.FLAGS.MANAGE_EMOJIS_AND_STICKERS)) {
        return message.channel.send('You need the "Manage Emojis" permission to rename emojis!');
    }

    try {
        const content = message.content.split(' ');
        if (!content.length === 4) {return await message.channel.send(`Usage: \`${prefix}emoji rename <new name> <emoji>\``);}
        const newName = content[2];
        const emojiString = content[3];
        const emojiID = tools.extractEmoji(emojiString, true);
        const emojis = message.guild.emojis.cache
        const emoji = emojis.find(emoji => emoji.id === emojiID);

        if (emoji) {
            const oldName = emoji.name;
            message.guild.emojis.fetch(emojiID).then(emoji => { emoji.edit({ name: newName }) });
            message.channel.send(`Emoji successfully renamed from \`${oldName}\` to \`${newName}\`!`);
        } else {
            message.channel.send(`Emoji not found!`);
        }
    } catch (err) {
        return await message.channel.send(`Usage: \`${prefix}emoji rename <new name> <emoji>\``);
    }
}