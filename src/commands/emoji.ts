import {
    Attachment,
    DiscordAPIError,
    GuildEmoji,
    Message,
    MessageType,
    PermissionFlagsBits,
} from "discord.js";
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

const emojiRegex = new RegExp(/<a?:\w+:\d+>/gi);

export async function linkEmoji(message: Message): Promise<Message<boolean>> {
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

    if (emojis?.length) {
        const emojiStringOutput = await bulkAddEmojis(message, emojis);
        if (!emojiStringOutput) return;
        return message.channel.send(emojiStringOutput);
    }

    if (2 > name.length || name.length > 32)
        return message.channel.send("The name must be between 2 and 32 characters long.");

    const source = content.length >= 4 ? content[3] : content[2];
    if (!source) return message.channel.send("You have to provide an image!");

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
    try {
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
    } catch (error) {
        let errorMessage: string;
        if (error instanceof DiscordAPIError) {
            switch (+error.code) {
                case 50138:
                    errorMessage = `The emoji \`${name}\` does not fit under the size limit!`;
                    break;
                case 30008:
                    errorMessage = `Could not add \`${name}\`, you've hit the limit!`;
                    break;
                case 50035:
                    errorMessage = `Could not add \`${name}\`, the name is invalid!`;
                    break;
                default:
                    errorMessage = `Could not add \`${name}\`, unknown error! Error message: ${error.message}`;
                    break;
            }
            return await message.channel.send(errorMessage);
        }
    }

    // Sends newly created emoji to the channel
    if (emoji && emoji.animated) {
        return await message.channel.send(`<a:${emoji.name}:${emoji.id}>`);
    } else if (emoji && !emoji.animated) {
        return await message.channel.send(`<:${emoji.name}:${emoji.id}>`);
    }
}

/**
 * Adds a list of emojis to the server
 * @param message The message to check
 * @param emojis The list of emojis to add, previously matched with a regex
 * @returns A string containing the newly added emojis
 *
 */
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
            let errorMessage: string;
            if (error instanceof DiscordAPIError) {
                switch (+error.code) {
                    case 50138:
                        errorMessage = `The emoji \`${name}\` does not fit under the size limit!`;
                        break;
                    case 30008:
                        errorMessage = `Could not add \`${name}\`, you've hit the limit!`;
                        break;
                    default:
                        errorMessage = `Could not add \`${name}\`, unknown error! Error message: ${error.message}`;
                        break;
                }
                await message.channel.send(errorMessage);
                continue;
            }
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

export async function removeEmoji(message: Message): Promise<void> {
    if (!hasPermission(PermissionFlagsBits.ManageEmojisAndStickers, message)) {
        await message.channel.send(
            'You need the "Manage Emoji and Stickers" permission to remove emojis'
        );
        return;
    }

    const emojiStrings = message.content.match(emojiRegex);
    if (!emojiStrings || emojiStrings.length === 0) {
        await message.channel.send(`You need to provide at least one emoji to remove`);
        return;
    }

    const emojiIds = emojiStrings.map((emoji) => extractEmoji(emoji, true));

    for (const id of emojiIds) {
        const emojiStr = emojiStrings[emojiIds.indexOf(id)];
        try {
            const emoji = await message.guild?.emojis.fetch(id);
            if (!emoji) continue;
            const deletedEmoji = await emoji.delete();
            await message.channel.send(`Successfully deleted \`${deletedEmoji.name}\``);
        } catch (error) {
            if (error instanceof DiscordAPIError) {
                let errorMessage: string;
                switch (+error.code) {
                    case 10014:
                        errorMessage = `\`${emojiStr}\` does not exist in this server`;
                        break;
                    default:
                        errorMessage = `Failed to delete \`${emojiStr}\`, unknown error! Error message: ${error.message}`;
                        break;
                }
                await message.channel.send(errorMessage);
                continue;
            }
        }
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
