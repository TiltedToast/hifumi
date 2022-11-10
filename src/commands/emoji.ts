import { Attachment, GuildEmoji, Message, MessageType, PermissionFlagsBits } from "discord.js";
import * as fs from "fs";
import { FileSizeLimit } from "../helpers/types.js";
import {
    createTemp,
    downloadURL,
    extractEmoji,
    getImgType,
    hasPermission,
    isValidSize,
    resize,
} from "../helpers/utils.js";

export async function linkEmoji(message: Message): Promise<Message<boolean>> {
    const emojiRegex = new RegExp(/<a?:[a-zA-Z0-9]{1,32}:[0-9]{18}>/gi);

    let msgContent = message.content;

    if (message.type === MessageType.Reply) {
        const repliedMsg = message.channel.messages.resolve(message.reference?.messageId ?? "");
        if (!repliedMsg)
            return await message.channel.send("Could not find message to grab emojis from!");
        msgContent = repliedMsg.content;
    }

    const emojis = msgContent.match(emojiRegex);
    if (!emojis) return await message.channel.send("You have to specify at least one emoji!");

    const output = emojis.map((emoji) => extractEmoji(emoji)).join("\n");
    return await message.channel.send(output);
}

export async function addEmoji(message: Message, prefix: string): Promise<void | Message<boolean>> {
    let name = "",
        emoji,
        url = "";

    const emojiRegex = new RegExp(/<a?:[a-zA-Z0-9]+:[0-9]+>/gi);

    if (!hasPermission(PermissionFlagsBits.ManageEmojisAndStickers, message)) {
        return await message.channel.send(
            'You need the "Manage Emoji and Stickers" permission to add emojis!'
        );
    }
    const content = message.content.split(" ");

    if (message.type === MessageType.Reply) {
        const repliedMsg = message.channel.messages.resolve(message.reference?.messageId ?? "");
        if (!repliedMsg)
            return await message.channel.send("Could not find message to grab emojis from!");

        const emojis = repliedMsg.content.match(emojiRegex);
        if (!emojis)
            return await message.channel.send("The message must contain at least one emoji!");
        return message.channel.send(await bulkAddEmojis(message, emojis));
    }

    // Check if the user provided a name and an image n
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

    const emojis = message.content.match(emojiRegex);

    createTemp("temp");

    if (emojis?.includes(content[2])) {
        return message.channel.send(await bulkAddEmojis(message, emojis));
    }

    if (2 > name.length || name.length > 32)
        return message.channel.send("The name must be between 2 and 32 characters long.");

    const source = content.length >= 4 ? content[3] : content[2];
    if (source === null) return message.channel.send("You have to provide an image!");

    const urlPattern = new RegExp(/https?:\/\/.*\.(?:png|jpg|jpeg|webp|gif)/i);
    const isValidURL = urlPattern.test(source);

    // Matches the source string against a url regex and sets the url variable
    if (!isValidURL && !source.startsWith("<") && message.attachments.size === 0) {
        return message.channel.send("Invalid source url!");
    } else if (source.startsWith("<")) {
        url = extractEmoji(source);
    } else if (isValidURL) {
        url = source;
    } else if (message.attachments.size > 0) {
        url = (message.attachments.first() as Attachment).url;
    }

    createTemp("temp");
    const imgType = getImgType(url);
    if (!imgType) return await message.channel.send("Invalid image type!");

    const fetchErrorMsg = await downloadURL(url, `./temp/unknown.${imgType}`);
    if (fetchErrorMsg) return await message.channel.send(fetchErrorMsg);

    // Resizes image, checks size again and creates emoji
    if (!isValidSize(`./temp/unknown.${imgType}`, FileSizeLimit.DiscordEmoji)) {
        await resize({
            fileLocation: `./temp/unknown.${imgType}`,
            width: 128,
            saveLocation: `./temp/unknown_resized.${imgType}`,
        });

        if (!isValidSize(`./temp/unknown_resized.${imgType}`, FileSizeLimit.DiscordEmoji)) {
            return message.channel.send("File too large for Discord, even after resizing!");
        }
        if (message.guild === null) return message.channel.send("You can't add emojis to DMs!");
        const base64 = fs.readFileSync(`./temp/unknown_resized.${imgType}`, {
            encoding: "base64",
        });
        emoji = await message.guild.emojis.create({
            attachment: `data:image/${imgType};base64,${base64}`,
            name,
        });
    } else {
        if (message.guild === null) return message.channel.send("You can't add emojis to DMs!");
        const base64 = fs.readFileSync(`./temp/unknown.${imgType}`, {
            encoding: "base64",
        });
        emoji = await message.guild.emojis.create({
            attachment: `data:image/${imgType};base64,${base64}`,
            name,
        });
    }

    // Sends newly created emoji to the channel
    if (emoji && emoji.animated) {
        return await message.channel.send(`Emoji added! <a:${emoji.name}:${emoji.id}>`);
    } else if (emoji && !emoji.animated) {
        return await message.channel.send(`Emoji added! <:${emoji.name}:${emoji.id}>`);
    }
}

async function bulkAddEmojis(message: Message, emojis: RegExpMatchArray) {
    let output = "";
    let msg: string;
    let emoji: GuildEmoji | undefined;

    for (const emojiStr of emojis) {
        const url = extractEmoji(emojiStr);
        const imgType = getImgType(url);
        const name = emojiStr.split(":")[1];
        const filePath = `temp/${name}.${imgType}`;

        await downloadURL(url, filePath);

        try {
            const base64 = fs.readFileSync(filePath, { encoding: "base64" });
            emoji = await message.guild?.emojis.create({
                attachment: `data:image/${imgType};base64,${base64}`,
                name,
            });
        } catch (error) {
            await message.channel.send(`Could not add ${name}, you've hit the limit!`);
            continue;
        }
        if (emoji === undefined) {
            await message.channel.send(
                "Couldn't create emoji, Discord might be having issues with their API!"
            );
            continue;
        }

        if (imgType === null) {
            msg = emojiStr;
        } else if (imgType === "gif") {
            msg = `<a:${emoji.name}:${emoji.id}>`;
        } else {
            msg = `<:${emoji.name}:${emoji.id}>`;
        }

        output += `${msg}\n`;
    }
    return output;
}

export async function removeEmoji(message: Message, prefix: string): Promise<Message> {
    if (!hasPermission(PermissionFlagsBits.ManageEmojisAndStickers, message)) {
        return message.channel.send(
            'You need the "Manage Emoji and Stickers" permission to remove emojis!'
        );
    }

    const content = message.content.split(" ");

    try {
        if (content.length !== 3)
            return await message.channel.send(`Usage: \`${prefix}emoji remove <emoji>\``);

        const emojiString = content[2];
        const emojiID = extractEmoji(emojiString, true);
        const guildEmojis = message.guild?.emojis.cache;
        const emoji = guildEmojis?.find((emoji) => emoji.id === emojiID);

        if (!emoji) return message.channel.send(`Emoji not found!`);

        emoji.delete();
        return message.channel.send(`Emoji successfully deleted!`);
    } catch (error) {
        return await message.channel.send(`Usage: \`${prefix}emoji remove <emoji>\``);
    }
}

export async function renameEmoji(message: Message, prefix: string): Promise<Message> {
    if (!hasPermission(PermissionFlagsBits.ManageEmojisAndStickers, message)) {
        return message.channel.send(
            'You need the "Manage Emoji and Stickers" permission to rename emojis!'
        );
    }

    try {
        const content = message.content.split(" ");
        if (content.length !== 4)
            return await message.channel.send(
                `Usage: \`${prefix}emoji rename <new name> <emoji>\``
            );

        const newName = content[2];
        const emojiString = content[3];
        const emojiId = extractEmoji(emojiString, true);
        const guildEmojis = message.guild?.emojis.cache;
        const emoji = guildEmojis?.find((emoji) => emoji.id === emojiId);

        if (!emoji) return message.channel.send(`Emoji not found!`);

        const oldName = Object.assign({}, emoji).name;
        emoji.edit({ name: newName });
        return message.channel.send(
            `Emoji successfully renamed from \`${oldName}\` to \`${newName}\`!`
        );
    } catch (err) {
        return await message.channel.send(`Usage: \`${prefix}emoji rename <new name> <emoji>\``);
    }
}
