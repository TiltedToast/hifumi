import { readFile } from "node:fs/promises";
import type { ChatInputCommandInteraction, User } from "discord.js";
import qr from "qrcode";
import sharp from "sharp";
import {
    FileSizeLimit,
    type ImgurResponse,
    ImgurResponseSchema,
    type NarrowedMessage,
} from "../helpers/types.ts";
import {
    createTemp,
    downloadURL,
    getImgType,
    getUserObjectPingId,
    isChatInputCommandInteraction,
    isValidSize,
    resize,
    sendOrReply,
} from "../helpers/utils.ts";

export async function beautiful(
    input: NarrowedMessage | ChatInputCommandInteraction
) {
    let user: User;

    if (isChatInputCommandInteraction(input)) {
        user = input.options.getUser("user") ?? input.user;
    } else {
        const content = input.content.split(" ").filter(Boolean);
        const tmp =
            content.length === 1
                ? input.author
                : await getUserObjectPingId(input);

        if (!tmp)
            return await input.channel.send("Couldn't find the specified User");
        user = tmp;
    }

    await using temp = await createTemp();

    const avatarUrl =
        user.avatarURL({ size: 4096, forceStatic: true }) ??
        user.defaultAvatarURL;

    const errorMsg = await downloadURL(avatarUrl, `${temp.path}/avatar.png`);
    if (errorMsg) return await sendOrReply(input, errorMsg);

    const output = await resize({
        fileLocation: `${temp.path}/avatar.png`,
        width: 180,
        saveLocation: `${temp.path}/avatar_resized.png`,
        animated: false,
    });

    if (!output || ("exitCode" in output && output.exitCode !== 0)) {
        return await sendOrReply(
            input,
            "I'm sorry, failed to resize the pfp. Maybe try again later?"
        );
    }

    const canvas = sharp({
        create: {
            width: 640,
            height: 674,
            channels: 4,
            background: {
                r: 0,
                g: 0,
                b: 0,
                alpha: 0,
            },
        },
    });

    const avatar = await sharp(`${temp.path}/avatar_resized.png`)
        .toBuffer()
        .catch(console.error);

    const background = await sharp("./src/assets/beautiful_background.png")
        .toBuffer()
        .catch(console.error);

    if (!avatar || !background) {
        return await sendOrReply(
            input,
            "I'm sorry, failed to load some of the images. Maybe try again later?"
        );
    }

    // biome-ignore format: this is nicer
    canvas.composite([
        { input: avatar,     top: 35,  left: 422 }, // Top pfp
        { input: avatar,     top: 377, left: 430 }, // Bottom pfp
        { input: background, top: 0,   left: 0 },   // Background
    ]);

    const buf = await canvas.png().toBuffer().catch(console.error);

    if (!buf)
        return await sendOrReply(
            input,
            "I'm sorry, failed to create the image. Maybe try again later?"
        );

    return await sendOrReply(input, { files: [buf] }, false);
}

export async function qrCode(
    input: NarrowedMessage | ChatInputCommandInteraction
) {
    let qrText: string;
    if (isChatInputCommandInteraction(input)) {
        qrText = input.options.getString("data", true);
    } else {
        qrText = input.content;
    }

    if (!qrText.length) return await sendOrReply(input, "Invalid input!");

    const buf = await qr.toBuffer(qrText).catch(console.error);

    if (!buf)
        return await sendOrReply(input, "Data too big to fit into a QR code!");

    return await sendOrReply(input, {
        files: [buf],
    });
}

export async function resizeImg(message: NarrowedMessage, prefix: string) {
    const content = message.content.split(" ").filter(Boolean);

    // Checks for invalid User input
    if (content.length !== 3 && message.attachments.size === 0) {
        return await message.channel.send(
            `Usage: \`${prefix}resize <width> <url>\``
        );
    }
    if (content.length === 1 && message.attachments.size > 0) {
        return await message.channel.send("You have to provide the width!");
    }

    const width = Math.floor(Number(content[1]));

    if (Number.isNaN(width) || width <= 0)
        return await message.channel.send("Invalid width!");
    if (width > 5000) return await message.channel.send("Width too large!");

    const source =
        message.attachments.size > 0
            ? message.attachments.first()?.url
            : content[2];

    if (!source) return await message.channel.send("Invalid URL!");

    const urlPattern = new RegExp(
        /https?:\/\/.*\.(?:png|jpeg|gif|avif|tiff|webp|svg)/i
    );
    const isValidURL = urlPattern.test(source);

    // Matches URL against a regex pattern and invalidates gif files (they are not supported yet)
    if (!isValidURL) return await message.channel.send("Invalid source url!");

    const imgType = getImgType(source);
    if (!imgType) return await message.channel.send("Invalid image type!");

    await using temp = await createTemp();

    const errorMsg = await downloadURL(
        source,
        `${temp.path}/unknown.${imgType}`
    );
    if (errorMsg) return await message.channel.send(errorMsg);

    const output = await resize({
        fileLocation: `${temp.path}/unknown.${imgType}`,
        width,
        saveLocation: `${temp.path}/unknown_resized.${imgType}`,
        animated: imgType === "gif",
    });

    if (!output || ("exitCode" in output && output.exitCode !== 0)) {
        return await message.channel.send(
            "I'm sorry, failed to resize the image. Maybe try again later?"
        );
    }

    if (
        !isValidSize(
            `${temp.path}/unknown_resized.${imgType}`,
            FileSizeLimit.DiscordFile
        )
    ) {
        return await message.channel.send("File too large for Discord!");
    }

    await message.channel.send({
        files: [`${temp.path}/unknown_resized.${imgType}`],
    });
}

export async function imgur(message: NarrowedMessage, prefix: string) {
    const content = message.content.split(" ").filter(Boolean);

    if (content.length !== 2 && message.attachments.size === 0) {
        return await message.channel.send(`Usage: \`${prefix}imgur <url>\``);
    }

    let source =
        message.attachments.size > 0
            ? message.attachments.first()?.url
            : content[1];

    if (!source) return await message.channel.send("Invalid URL!");

    const urlPattern = new RegExp(/https?:\/\/.*\.(?:png|jpg|jpeg|webp|gif)/i);
    const isValidURL = urlPattern.test(source);

    // Matches URL against a regex pattern
    if (!isValidURL) return await message.channel.send("Invalid source url!");

    // Imgur API doesn't support webp images
    if (source.includes(".webp")) source = source.replace(".webp", ".png");

    const imgType = getImgType(source);
    if (!imgType) return await message.channel.send("Invalid image type!");

    const myHeaders = new Headers();
    const formdata = new FormData();
    myHeaders.append(
        "Authorization",
        `Client-ID ${process.env.IMGUR_CLIENT_ID}`
    );

    const requestOptions: RequestInit = {
        method: "POST",
        headers: myHeaders,
        body: formdata,
        redirect: "follow",
    };

    // Checks for valid image size via Content-Length header if possible
    // If present, uploads the image to Imgur and sends the link to the channel if it's within the size limit (10MB)
    // If not, downloads the image and checks for valid size before uploading to Imgur
    const response = await fetch(source, {
        headers: source.includes("pximg")
            ? { Referer: "https://www.pixiv.net/" }
            : undefined,
    }).catch(console.error);

    if (!response) {
        return await message.channel.send(
            "Something went wrong checking the image size"
        );
    }

    const contentLength = response.headers.get("Content-Length");

    if (!response.headers.has("Content-Length")) {
        await using temp = await createTemp();

        const errorMsg = await downloadURL(
            source,
            `${temp.path}/unknown.${imgType}`
        );
        if (errorMsg) return await message.channel.send(errorMsg);

        if (
            !isValidSize(
                `${temp.path}/unknown.${imgType}`,
                FileSizeLimit.ImgurFile
            )
        ) {
            return await message.channel.send(
                "File too large for Imgur! (10MB limit)"
            );
        }

        const contents = await readFile(
            `${temp.path}/unknown.${imgType}`,
            "base64"
        );

        formdata.append("image", contents);

        const response = await fetch(
            "https://api.imgur.com/3/image",
            requestOptions
        ).catch(console.error);

        if (!response) {
            return await message.channel.send(
                "Failed to upload the image. Something must've gone really wrong for this to happen"
            );
        }
        const result = (await response
            .json()
            .catch(console.error)) as ImgurResponse;

        if (!result) {
            return await message.channel.send(
                "Imgur API returned an invalid response. Maybe try again later?"
            );
        }

        if (!response.ok) {
            return message.channel.send(
                `Failed to upload image: ${result.data.error?.message ?? "Unknown Error"}`
            );
        }

        if (!ImgurResponseSchema.safeParse(result).success) {
            return await message.channel.send(
                "Something went wrong with the API, maybe try again later"
            );
        }

        return await message.channel.send(result.data.link);
    }
    if (
        contentLength !== null &&
        Number.parseInt(contentLength, 10) <= FileSizeLimit.ImgurFile
    ) {
        formdata.append("image", source);

        const response = await fetch(
            "https://api.imgur.com/3/image",
            requestOptions
        ).catch(console.error);

        if (!response)
            return await message.channel.send(
                "Failed to upload the image. Something must've gone really wrong for this to happen"
            );
        const result = (await response
            .json()
            .catch(console.error)) as ImgurResponse;

        if (!result) {
            return await message.channel.send(
                "Imgur API returned an invalid response. Maybe try again later?"
            );
        }

        if (!response.ok)
            return message.channel.send(
                `Failed to upload image: ${result.data.error?.message ?? "Unknown Error"}`
            );

        if (!ImgurResponseSchema.safeParse(result).success) {
            return await message.channel.send(
                "Something went wrong with the API, maybe try again later"
            );
        }

        return await message.channel.send(result.data.link);
    }
    return await message.channel.send("File too large for Imgur! (10MB limit)");
}
