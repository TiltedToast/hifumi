import * as tools from './tools.js';
import { Permissions } from 'discord.js';

export async function addEmoji(interaction) {
    await interaction.deferReply();
    if (interaction.member.permissions.has(Permissions.FLAGS.MANAGE_EMOJIS_AND_STICKERS)) {
        const name = interaction.options.getString('name');
        const source = interaction.options.getString('source');
        let url;

        if (name.length < 2 || name.length > 32) {
            return interaction.editReply('The name must be between 2 and 32 characters long.');
            
        }
        const urlPattern = /https?:\/\/.*\.(?:png|jpg|jpeg|webp|gif)/i;

        if (source.match(urlPattern) === null && !source.startsWith('<')) {
            return interaction.editReply('Invalid source url!');
        } else if (source.startsWith('<')) {
            url = tools.extractEmoji(source);
        } else if (source.match(urlPattern).length === 1) {
            url = source.match(urlPattern)[0];
        }

        if (url.includes('pximg')) { return interaction.editReply('Pixiv urls don\'t work yet, try uploading it to imgur first!'); }

        const emoji = await interaction.guild.emojis.create(url, name);

        if (emoji && emoji.animated) {
            interaction.editReply(`Emoji added! <a:${emoji.name}:${emoji.id}>`);
        } else if (emoji && !emoji.animated) {
            interaction.editReply(`Emoji added! <:${emoji.name}:${emoji.id}>`);
        }
    } else {
        interaction.editReply('You need the "Manage Emojis" permission to add emojis!');
    }
}

export async function removeEmoji(interaction) {
    await interaction.deferReply();
    if (interaction.member.permissions.has(Permissions.FLAGS.MANAGE_EMOJIS_AND_STICKERS)) {
        try {
            const emojiString = interaction.options.getString('emoji');
            const emojiID = tools.extractEmoji(emojiString, true);
            const emojis = interaction.guild.emojis.cache
            const emoji = emojis.find(emoji => emoji.id === emojiID);

            if (emoji) {
                emoji.delete();
                interaction.editReply(`Emoji successfully deleted!`);
            } else {
                interaction.editReply(`Emoji not found!`);
            }
        } catch (TypeError) { return interaction.reply('Invalid emoji!'); }
    } else {
        interaction.editReply('You need the "Manage Emojis" permission to remove emojis!');
    }
}


export async function renameEmoji(interaction) {
    await interaction.deferReply();
    if (interaction.member.permissions.has(Permissions.FLAGS.MANAGE_EMOJIS_AND_STICKERS)) {
        try {
            const newName = interaction.options.getString('newname');
            const emojiString = interaction.options.getString('emoji');
            const emojiID = tools.extractEmoji(emojiString, true);
            const emojis = interaction.guild.emojis.cache
            const emoji = emojis.find(emoji => emoji.id === emojiID);

            if (emoji) {
                const oldName = emoji.name;
                interaction.guild.emojis.fetch(emojiID).then(emoji => { emoji.edit({ name: newName }) });
                interaction.editReply(`Emoji successfully renamed from ${oldName} to ${newName}!`);
            } else {
                interaction.editReply(`Emoji not found!`);
            }
        } catch (TypeError) { return interaction.editReply('Invalid emoji!'); }
    } else {
        interaction.editReply('You need the "Manage Emojis" permission to rename emojis!');
    }
}