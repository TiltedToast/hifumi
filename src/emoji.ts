import * as tools from "./tools.js";
import { Message, MessageAttachment, Permissions, GuildEmoji } from "discord.js";

export async function linkEmoji(message: Message) {
    let output = "";

    const emojiRegex = new RegExp(/<a?:[a-zA-Z0-9]{1,32}:[0-9]{18}>/gi);

    const emojis = message.content.match(emojiRegex);
    if (!emojis) return await message.channel.send("You have to specify at least one emoji!");

    for (const emoji of emojis) {
        output += `${tools.extractEmoji(emoji)}\n`;
    }
    await message.channel.send(output);
}

export async function addEmoji(message: Message, prefix: string): Promise<Message | undefined> {
    let name = "",
        emoji,
        url = "";

    if (!message.member?.permissions.has(Permissions.FLAGS.MANAGE_EMOJIS_AND_STICKERS)) {
        return await message.channel.send('You need the "Manage Emojis" permission to add emojis!');
    }
    const content = message.content.split(" ");

    // Check if the user provided a name and an image
    if (content.length === 2 && message.attachments.size === 0) {
        return await message.channel.send(`Usage: \`${prefix}emoji add <name> <url/emoji>\``);
    } else if (content.length === 2 && message.attachments.size > 0) {
        return await message.channel.send("You have to specify a name!");
    } else if (content.length === 3 && content[2].startsWith("http")) {
        return await message.channel.send("You have to specify a name!");
    }

    // Sets name based on whether the user provided an emoji or not
    if (content[2].startsWith("<") && content[2].endsWith(">")) {
        name = content[2].split(":")[1];
    } else {
        name = content[2];
    }

    const emojiRegex = new RegExp(/<a?:[a-zA-Z0-9]{1,32}:[0-9]{18}>/gi);
    const emojis = message.content.match(emojiRegex);

    tools.createTemp("temp");

    if (emojis?.includes(content[2])) {
        let output = "";
        let msg: string;
        let emoji: GuildEmoji | undefined;

        for (const emojiStr of emojis) {
            const url = tools.extractEmoji(emojiStr);
            const imgType = tools.getImgType(url);
            const name = emojiStr.split(":")[1];
            const filePath = `temp/${name}.${imgType}`;

            await tools.downloadURL(url, filePath);

            try {
                emoji = await message.guild?.emojis.create(filePath, name);
            } catch (error) {
                await message.channel.send(`Could not add ${name}, you've hit the limit!`);
                continue;
            }
            if (emoji === undefined) {
                await message.channel.send("Couldn't create emoji, Discord might be having issues with their API!");
                continue;
            }

            if (imgType === "gif") {
                msg = `<a:${emoji.name}:${emoji.id}>`;
            } else if (imgType !== "gif") {
                msg = `<:${emoji.name}:${emoji.id}>`;
            } else {
                msg = emojiStr;
            }

            output += `${msg}\n`;
        }
        return await message.channel.send(output);
    }

    if (!(2 < name.length && name.length < 32))
        return message.channel.send("The name must be between 2 and 32 characters long.");

    const source = content.length >= 4 ? content[3] : content[2];
    if (source === null) return message.channel.send("You have to provide an image!");

    const urlPattern = new RegExp(/https?:\/\/.*\.(?:png|jpg|jpeg|webp|gif)/i);
    const isValidURL = urlPattern.test(source);

    // Matches the source string against a url regex and sets the url variable
    if (!isValidURL && !source.startsWith("<") && message.attachments.size === 0) {
        return message.channel.send("Invalid source url!");
    } else if (source.startsWith("<")) {
        url = tools.extractEmoji(source);
    } else if (isValidURL) {
        url = source;
    } else if (message.attachments.size > 0) {
        url = (message.attachments?.first() as MessageAttachment).url;
    }

    tools.createTemp("temp");
    const imgType = tools.getImgType(url);
    if (imgType === "unknown") return await message.channel.send("Invalid image type!");

    const fetchErrorMsg = await tools.downloadURL(url, `./temp/unknown.${imgType}`);
    if (fetchErrorMsg) return await message.channel.send(fetchErrorMsg);

    // Resizes image, checks size again and creates emoji
    if (!tools.isValidSize(`./temp/unknown.${imgType}`, 262144)) {
        await tools.resize(`./temp/unknown.${imgType}`, 128, `./temp/unknown_resized.${imgType}`);

        if (!tools.isValidSize(`./temp/unknown_resized.${imgType}`, 262144)) {
            return message.channel.send("File too large for Discord, even after resizing!");
        }
        if (message.guild === null) return message.channel.send("You can't add emojis to DMs!");
        emoji = await message.guild.emojis.create(`./temp/unknown_resized.${imgType}`, name);
    } else {
        if (message.guild === null) return message.channel.send("You can't add emojis to DMs!");
        emoji = await message.guild.emojis.create(`./temp/unknown.${imgType}`, name);
    }

    // Sends newly created emoji to the channel
    if (emoji && emoji.animated) {
        return await message.channel.send(`Emoji added! <a:${emoji.name}:${emoji.id}>`);
    } else if (emoji && !emoji.animated) {
        return await message.channel.send(`Emoji added! <:${emoji.name}:${emoji.id}>`);
    }
}

export async function removeEmoji(message: Message, prefix: string): Promise<Message> {
    if (!message.member?.permissions.has(Permissions.FLAGS.MANAGE_EMOJIS_AND_STICKERS)) {
        return message.channel.send('You need the "Manage Emojis" permission to remove emojis!');
    }

    const content = message.content.split(" ");

    try {
        if (content.length !== 3) return await message.channel.send(`Usage: \`${prefix}emoji remove <emoji>\``);

        const emojiString = content[2];
        const emojiID = tools.extractEmoji(emojiString, true);
        const emojis = message.guild?.emojis.cache;
        const emoji = emojis?.find((emoji) => emoji.id === emojiID);

        if (emoji) {
            emoji.delete();
            return message.channel.send(`Emoji successfully deleted!`);
        } else {
            return message.channel.send(`Emoji not found!`);
        }
    } catch (error) {
        return await message.channel.send(`Usage: \`${prefix}emoji remove <emoji>\``);
    }
}

export async function renameEmoji(message: Message, prefix: string): Promise<Message> {
    if (!message.member?.permissions.has(Permissions.FLAGS.MANAGE_EMOJIS_AND_STICKERS)) {
        return message.channel.send('You need the "Manage Emojis" permission to rename emojis!');
    }

    try {
        const content = message.content.split(" ");
        if (content.length !== 4)
            return await message.channel.send(`Usage: \`${prefix}emoji rename <new name> <emoji>\``);

        const newName = content[2];
        const emojiString = content[3];
        const emojiId = tools.extractEmoji(emojiString, true);
        const emojis = message.guild?.emojis.cache;
        const emoji = emojis?.find((emoji) => emoji.id === emojiId);

        if (emoji) {
            const oldName = emoji.name;
            message.guild?.emojis.fetch(emojiId).then((emoji) => {
                emoji.edit({ name: newName });
            });
            return message.channel.send(`Emoji successfully renamed from \`${oldName}\` to \`${newName}\`!`);
        } else {
            return message.channel.send(`Emoji not found!`);
        }
    } catch (err) {
        return await message.channel.send(`Usage: \`${prefix}emoji rename <new name> <emoji>\``);
    }
}
