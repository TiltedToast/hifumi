import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import { $ } from "bun";
import {
    DiscordAPIError,
    type GuildEmoji,
    MessageType,
    PermissionFlagsBits,
    RESTJSONErrorCodes,
    type Sticker,
    StickerFormatType,
} from "discord.js";
import Fuse from "fuse.js";
import { FileSizeLimit, type NarrowedMessage } from "../helpers/types.ts";
import {
    convertStaticImg,
    createTemp,
    downloadURL,
    getImgType,
    hasPermission,
    isValidSize,
    parseEmoji,
    resize,
    splitMessage,
} from "../helpers/utils.ts";

export const emojiRegex = new RegExp(/<a?:\w+:\d+>/gi);
const msgLinkRegex = new RegExp(
    /https:\/\/discord\.com\/channels\/\d+\/(\d+)\/(\d+)/
);

export async function pngToGifEmoji(message: NarrowedMessage) {
    if (!message.guild) {
        return await message.channel.send(
            "You have to be in a server to use this command!"
        );
    }

    if (
        !hasPermission(
            message.member,
            PermissionFlagsBits.ManageGuildExpressions
        )
    ) {
        return await message.channel.send(
            'You need the "Manage Expressions" permission to convert emojis to GIFs!'
        );
    }

    if (message.type === MessageType.Reply) {
        const repliedMsg = message.channel.messages.resolve(
            message.reference?.messageId ?? ""
        );
        if (!repliedMsg) {
            return await message.channel.send(
                "Could not find message to grab emojis from!"
            );
        }
        const emojis = repliedMsg.content.match(emojiRegex);
        if (!emojis) {
            return await message.channel.send(
                "You have to specify at least one emoji!"
            );
        }

        return convertEmojis(emojis, message);
    }

    const emojis = message.content.match(emojiRegex);

    if (!emojis)
        return await message.channel.send(
            "You have to specify at least one emoji!"
        );

    await convertEmojis(emojis, message);
}

async function convertEmojis(
    emojis: RegExpMatchArray,
    message: NarrowedMessage
) {
    await using temp = await createTemp();

    let output = "";

    for (const emoji of emojis) {
        const parsed = parseEmoji(emoji);
        const guildEmoji = await message.guild?.emojis
            .fetch(parsed.id)
            .catch(() => null);

        if (guildEmoji?.animated) {
            await message.channel.send(
                `\`${guildEmoji.name ?? "NameNotFound"}\` is already a GIF`
            );
            continue;
        }

        const url = guildEmoji
            ? guildEmoji.imageURL({ size: 128 })
            : parsed.url;

        const imgType = getImgType(url);
        if (!imgType) continue;

        const name = guildEmoji
            ? (guildEmoji.name ?? "NameNotFound")
            : parsed.name;

        const frameOnePath = path.join(
            temp.path,
            `${name}-${parsed.id}.${imgType}`
        );

        if (await downloadURL(url, frameOnePath)) {
            await message.channel.send(
                `Could not download \`${name}\`, skipping...`
            );
            continue;
        }

        const frameTwoPath = path.join(
            temp.path,
            `${name}-${parsed.id}_2.${imgType}`
        );

        const result = await copyFile(frameOnePath, frameTwoPath).catch((e) => {
            console.error(e);
            return null;
        });

        if (result === null) {
            await message.channel.send(
                `Could not copy \`${name}\`, skipping...`
            );
            continue;
        }

        const magickPrefix =
            process.platform === "win32" ? "magick convert" : "convert";

        const compressOutput = await $`
                ${magickPrefix} ${frameTwoPath} -quality 90 ${frameTwoPath}
            `.catch(console.error);

        if (!compressOutput || compressOutput.exitCode !== 0) {
            await message.channel.send(
                `Could not compress \`${name}\`, skipping...`
            );
            continue;
        }

        const gifPath = path.join(temp.path, `${name}-${parsed.id}.gif`);

        const convertOutput = await $`
                ${magickPrefix} ${frameOnePath} ${frameTwoPath} -delay 100 ${gifPath}
            `.catch(console.error);

        if (!convertOutput || convertOutput.exitCode !== 0) {
            await message.channel.send(
                `Could not convert \`${name}\`, skipping...`
            );
            continue;
        }

        if (!isValidSize(gifPath, FileSizeLimit.DiscordEmoji)) {
            const output = await resize({
                fileLocation: gifPath,
                width: 128,
                saveLocation: gifPath,
                animated: true,
            });

            if (!output || ("exitCode" in output && output.exitCode !== 0)) {
                await message.channel.send(
                    `Something went wrong while resizing \`${name}\`, skipping...`
                );
                continue;
            }

            if (!isValidSize(gifPath, FileSizeLimit.DiscordEmoji)) {
                await message.channel.send(
                    `\`${name}\` too large, even after resizing, skipping...`
                );
                continue;
            }
        }

        const base64 = await readFile(gifPath, { encoding: "base64" });
        const newEmoji = await message
            .guild!.emojis.create({
                attachment: `data:image/gif;base64,${base64}`,
                name,
            })
            .catch(console.error);

        if (!newEmoji) {
            await message.channel.send(
                `Could not create \`${name}\`, skipping...`
            );
            continue;
        }

        output += `${newEmoji.toString()} `;

        if (guildEmoji?.deletable)
            await guildEmoji.delete("Replaced with GIF version");
    }

    if (output === "") return;

    await message.channel.send({
        content: output,
    });
}

export async function linkEmoji(message: NarrowedMessage) {
    let msgContent = message.content;

    if (message.type === MessageType.Reply) {
        const repliedMsg = message.channel.messages.resolve(
            message.reference?.messageId ?? ""
        );
        if (!repliedMsg) {
            return await message.channel.send(
                "Could not find message to grab emojis from!"
            );
        }
        msgContent = repliedMsg.content;
    }

    const emojis = msgContent.match(emojiRegex);
    if (!emojis)
        return await message.channel.send(
            "You have to specify at least one emoji!"
        );

    const output = emojis.map((emoji) => parseEmoji(emoji).url).join("\n");
    return await message.channel.send(output);
}

export async function addEmoji(message: NarrowedMessage, prefix: string) {
    let name = "";
    let emoji: GuildEmoji;
    let url = "";

    if (
        !hasPermission(
            message.member,
            PermissionFlagsBits.CreateGuildExpressions
        )
    ) {
        return await message.channel.send(
            'You need the "Create Expressions" permission to add emojis!'
        );
    }
    const content = message.content.split(" ").filter(Boolean);

    if (message.type === MessageType.Reply) {
        const repliedMsg = message.channel.messages.resolve(
            message.reference?.messageId ?? ""
        );
        if (!repliedMsg)
            return await message.channel.send(
                "Could not find message to grab emojis/stickers from!"
            );

        const emojis = repliedMsg.content.match(emojiRegex);
        if (!emojis && repliedMsg.stickers.size === 0)
            return await message.channel.send(
                "The message must contain at least one emoji/sticker!"
            );

        if (emojis?.length) {
            const emojiStringOutput = await bulkAddEmojis(message, emojis);
            if (!emojiStringOutput) return;
            await message.channel.send(emojiStringOutput);
        }
        if (repliedMsg.stickers.size > 0) {
            await addStickers(repliedMsg as NarrowedMessage);
        }
        return;
    }

    const matchedArr = msgLinkRegex.exec(message.content);

    if (matchedArr) {
        const [channelId, msgId] = matchedArr.slice(1) as [string, string];

        const channel = await message.client.channels
            .fetch(channelId)
            .catch(() => null);

        if (!channel) {
            return await message.channel.send(
                "I probably don't have access to that channel"
            );
        }
        if (!channel.isTextBased()) {
            return await message.channel.send(
                "Somehow this is not a text channel?"
            );
        }

        const msg = await channel.messages.fetch(msgId).catch(() => null);

        if (!msg) {
            return await message.channel.send(
                "Could not find message to grab emojis from!"
            );
        }

        const emojis = msg.content.match(emojiRegex);

        if (emojis === null)
            return await message.channel.send("No emojis found");

        const emojiStringOutput = await bulkAddEmojis(message, emojis);
        if (!emojiStringOutput) return;
        return await message.channel.send(emojiStringOutput);
    }

    if (content.length <= 2 && message.attachments.size === 0) {
        return await message.channel.send(
            `Usage: \`${prefix}emoji add <name> <url/emoji>\``
        );
    }
    if (
        (content.length === 2 && message.attachments.size > 0) ||
        (content.length === 3 && content[2]!.startsWith("http"))
    ) {
        return await message.channel.send("You have to specify a name!");
    }

    // Sets name based on whether the user provided an emoji or not
    if (content[2]!.startsWith("<") && content[2]!.endsWith(">")) {
        name = content[2]!.split(":")[1]!;
    } else {
        name = content[2]!;
    }

    const emojis = message.content.match(emojiRegex);

    if (emojis?.length) {
        const emojiStringOutput = await bulkAddEmojis(message, emojis);
        if (!emojiStringOutput) return;
        return message.channel.send(emojiStringOutput);
    }

    if (2 > name.length || name.length > 32) {
        return message.channel.send(
            "The name must be between 2 and 32 characters long."
        );
    }

    const source = content.length >= 4 ? content[3] : content[2];
    if (!source) return message.channel.send("You have to provide an image!");

    const urlPattern = new RegExp(
        /https?:\/\/.*\.(?:png|jpeg|gif|avif|tiff|webp|svg)/i
    );
    const isValidURL = urlPattern.test(source);

    // Matches the source string against a url regex and sets the url variable
    if (
        !(isValidURL || source.startsWith("<")) &&
        message.attachments.size === 0
    ) {
        return message.channel.send("Invalid source url!");
    }
    if (source.startsWith("<")) {
        url = parseEmoji(source).url;
    } else if (isValidURL) {
        url = source;
    } else if (message.attachments.size > 0) {
        url = message.attachments.first()!.url;
    }

    await using temp = await createTemp();

    const imgType = getImgType(url);
    if (!imgType) return await message.channel.send("Invalid image type!");

    let ext = imgType;

    let fileLocation = path.join(temp.path, `unknown.${imgType}`);

    const errorMsg = await downloadURL(url, fileLocation);
    if (errorMsg) return await message.channel.send(errorMsg);

    if (!["png", "jpeg", "gif"].includes(imgType)) {
        const convertedFile = await convertStaticImg(fileLocation, "png");

        if (!convertedFile) {
            return message.channel.send("Failed to convert image to PNG!");
        }

        fileLocation = convertedFile;
        ext = "png";
    }

    const resizedLocation = path.join(temp.path, `unknown_resized.${ext}`);

    // Resizes image, checks size again and creates emoji
    try {
        if (!isValidSize(fileLocation, FileSizeLimit.DiscordEmoji)) {
            const output = await resize({
                fileLocation,
                width: 128,
                saveLocation: resizedLocation,
                animated: imgType === "gif",
            });

            if (!output || ("exitCode" in output && output.exitCode !== 0)) {
                return message.channel.send(
                    "Something went wrong while resizing the image, please try again!"
                );
            }

            if (!isValidSize(resizedLocation, FileSizeLimit.DiscordEmoji)) {
                return message.channel.send(
                    "File too large for Discord, even after resizing!"
                );
            }
            if (message.guild === null) {
                return message.channel.send(
                    "You have to be in a server to do this!"
                );
            }
            const base64 = await readFile(resizedLocation, {
                encoding: "base64",
            });
            emoji = await message.guild.emojis.create({
                attachment: `data:image/${imgType};base64,${base64}`,
                name,
            });
        } else {
            if (message.guild === null) {
                return message.channel.send(
                    "You have to be in a server to do this!"
                );
            }
            const base64 = await readFile(fileLocation, {
                encoding: "base64",
            });
            emoji = await message.guild.emojis.create({
                attachment: `data:image/${imgType};base64,${base64}`,
                name,
            });
        }
    } catch (error) {
        return await handleCreateError(error, message, name);
    }

    return await message.channel.send(emoji.toString());
}

const {
    FailedToResizeAssetBelowTheMinimumSize,
    MaximumNumberOfEmojisReached,
    MaximumNumberOfAnimatedEmojisReached,
    InvalidFormBodyOrContentType,
    MaximumNumberOfPremiumEmojisReached,
    UnknownEmoji,
    MaximumNumberOfStickersReached,
    StickerMaximumFramerateExceeded,
    UnknownSticker,
    UnknownStickerPack,
    StickerAnimationDurationExceedsMaximumOf5Seconds,
    StickerFramerateIsTooSmallOrTooLarge,
    StickerFrameCountExceedsMaximumOf1000Frames,
} = RESTJSONErrorCodes;

async function handleCreateError(
    error: unknown,
    message: NarrowedMessage,
    name: string
) {
    let errorMessage = `Could not add \`${name}\`, unknown error! `;

    if (error instanceof DiscordAPIError) {
        switch (+error.code) {
            case FailedToResizeAssetBelowTheMinimumSize:
                errorMessage = `The emoji \`${name}\` does not fit under the size limit!`;
                break;
            case MaximumNumberOfEmojisReached:
            case MaximumNumberOfAnimatedEmojisReached:
            case MaximumNumberOfStickersReached:
                errorMessage = `Could not add \`${name}\`, you've hit the limit!`;
                break;
            case InvalidFormBodyOrContentType:
                errorMessage = `Could not add \`${name}\`, the name is invalid!`;
                break;
            case MaximumNumberOfPremiumEmojisReached:
                errorMessage = `Could not add \`${name}\`, you've hit the limit for premium emojis!`;
                break;
            case StickerMaximumFramerateExceeded:
                errorMessage = `Could not add \`${name}\`, the framerate is too high!`;
                break;
            case UnknownSticker:
                errorMessage = `Could not add \`${name}\`, the sticker is invalid!`;
                break;
            case UnknownStickerPack:
                errorMessage = `Could not add \`${name}\`, the sticker pack is invalid!`;
                break;
            case StickerAnimationDurationExceedsMaximumOf5Seconds:
                errorMessage = `Could not add \`${name}\`, the animation duration is too high! (max 5 seconds)`;
                break;
            case StickerFramerateIsTooSmallOrTooLarge:
                errorMessage = `Could not add \`${name}\`, the framerate is too low or too high!`;
                break;
            case StickerFrameCountExceedsMaximumOf1000Frames:
                errorMessage = `Could not add \`${name}\`, the frame count is too high! (max 1000 frames)`;
                break;
            default:
                console.error(error);
                errorMessage =
                    `Could not add \`${name}\`, unknown error! ` +
                    `Error message: ${error.message}`;
                break;
        }
        return await message.channel.send(errorMessage);
    }
}

async function addStickers(message: NarrowedMessage) {
    const stickers = message.stickers;
    const addedStickers: Sticker[] = [];

    if (message.guild === null)
        return await message.channel.send("You must be in a server for this");

    if (stickers.size === 0) {
        return await message.channel.send("No stickers found!");
    }

    for (const sticker of stickers.values()) {
        const { name, url: file, format, tags, description } = sticker;

        if (format === StickerFormatType.Lottie) {
            await message.channel.send(
                `\`${name}\` is a Lottie sticker. I cannot add those yet unfortunately`
            );
            continue;
        }

        let newSticker: Sticker | undefined;

        try {
            newSticker = await message.guild.stickers.create({
                name,
                file,
                tags: tags || name,
                description,
            });
        } catch (error) {
            await handleCreateError(error, message, name);
            continue;
        }

        addedStickers.push(newSticker);
    }
    if (!addedStickers.length) return;

    await message.channel.send({ stickers: addedStickers });
}

/**
 * Adds a list of emojis to the server
 * @param message The message to check
 * @param emojis The list of emojis to add, previously matched with a regex
 * @returns A string containing the newly added emojis
 *
 */
async function bulkAddEmojis(
    message: NarrowedMessage,
    emojis: RegExpMatchArray
) {
    let output = "";
    let msg: string;
    let emoji: GuildEmoji | undefined;

    await using temp = await createTemp();

    for (const emojiStr of new Set(emojis)) {
        const url = parseEmoji(emojiStr).url;
        const imgType = getImgType(url);
        if (!imgType || !["png", "gif", "jpeg"].includes(imgType)) continue;

        const name = emojiStr.split(":")[1]!;
        const filePath = path.join(temp.path, `${name}.${imgType}`);

        const err = await downloadURL(url, filePath);

        if (err) {
            await message.channel.send(
                `Could not download ${name}, skipping...`
            );
            continue;
        }

        if (message.guild?.emojis.cache.find((emoji) => emoji.name === name)) {
            await message.channel.send(`Emoji \`${name}\` already exists!`);
            continue;
        }

        const base64 = await readFile(filePath, { encoding: "base64" }).catch(
            () => null
        );

        if (!base64) {
            await message.channel.send(`Could not read ${name}, skipping...`);
            continue;
        }

        try {
            emoji = await message.guild?.emojis.create({
                attachment: `data:image/${imgType};base64,${base64}`,
                name,
            });
        } catch (error) {
            await handleCreateError(error, message, name);
            continue;
        }
        if (emoji === undefined) {
            await message.channel.send(
                "Couldn't create emoji, Discord might be having issues with their API!"
            );
            continue;
        }

        if (emoji.animated) {
            msg = `<a:${emoji.name ?? "NameNotFound"}:${emoji.id}>`;
        } else {
            msg = `<:${emoji.name ?? "NameNotFound"}:${emoji.id}>`;
        }

        output += `${msg}\n`;
    }

    return output;
}

export async function removeEmoji(message: NarrowedMessage) {
    if (
        !hasPermission(
            message.member,
            PermissionFlagsBits.ManageGuildExpressions
        )
    ) {
        return await message.channel.send(
            'You need the "Manage Expressions" permission to remove emojis'
        );
    }

    const emojiStrings = message.content.match(emojiRegex);
    if (!emojiStrings || emojiStrings.length === 0) {
        return await message.channel.send(
            "You need to provide at least one emoji to remove"
        );
    }

    const emojiIds = emojiStrings.map((emoji) => parseEmoji(emoji).id);

    for (const id of new Set(emojiIds)) {
        const emojiStr = emojiStrings[emojiIds.indexOf(id)];
        try {
            const emoji = await message.guild?.emojis.fetch(id);
            if (!emoji) continue;
            const deletedEmoji = await emoji.delete();
            await message.channel.send(
                `Successfully deleted \`${deletedEmoji.name ?? "Name not found"}\``
            );
        } catch (error) {
            if (error instanceof DiscordAPIError) {
                let errorMessage: string;
                switch (+error.code) {
                    case UnknownEmoji:
                        errorMessage = `\`${emojiStr}\` does not exist in this server`;
                        break;
                    default:
                        errorMessage =
                            `Failed to delete \`${emojiStr}\`, unknown error! ` +
                            `Error message: ${error.message}`;
                        break;
                }
                await message.channel.send(errorMessage);
            }
        }
    }
}

export async function renameEmoji(message: NarrowedMessage, prefix: string) {
    if (
        !hasPermission(
            message.member,
            PermissionFlagsBits.ManageGuildExpressions
        )
    ) {
        return message.channel.send(
            'You need the "Manage Expressions" permission to rename emojis!'
        );
    }

    try {
        const content = message.content.split(" ").filter(Boolean);
        if (content.length !== 4)
            return await message.channel.send(
                `Usage: \`${prefix}emoji rename <new name> <emoji>\``
            );

        const newName = content[2]!;
        const emojiString = content[3]!;
        const emojiId = parseEmoji(emojiString).id;
        const guildEmojis = message.guild?.emojis.cache;
        const emoji = guildEmojis?.find((emoji) => emoji.id === emojiId);

        if (!emoji) return message.channel.send("Emoji not found!");

        const oldName = Object.assign({}, emoji).name;
        await emoji.edit({
            name: newName,
        });
        return message.channel.send(
            `Emoji successfully renamed from \`${oldName ?? "NameNotFound"}\` to \`${newName}\`!`
        );
    } catch (err) {
        return await message.channel.send(
            `Usage: \`${prefix}emoji rename <new name> <emoji>\``
        );
    }
}

export async function searchEmojis(message: NarrowedMessage) {
    const content = message.content.split(" ").filter(Boolean);
    if (content.length <= 2) {
        return await message.channel.send("Please provide a search term!");
    }

    const searchTerm = content[2]!.toLowerCase();
    const emojis = await message.guild?.emojis.fetch();

    if (!emojis) {
        return await message.channel.send(
            "You need to be in a server to use this command!"
        );
    }

    const emojiStrings = Array.from(emojis.map((x) => x.toString()));

    const fuse = new Fuse(emojiStrings, {
        shouldSort: true,
        threshold: 0.3,
    });

    const matchedEmojis = fuse.search(searchTerm).map((x) => x.item);

    if (matchedEmojis.length === 0) {
        return await message.channel.send("No matching emojis found!");
    }

    const outputString = matchedEmojis.join(" ");

    for (const chunk of splitMessage(outputString)) {
        await message.channel.send(chunk);
    }
}
