import { EmbedBuilder, Message, TextChannel } from "discord.js";
import fetch from "node-fetch";
import type { Submission } from "snoowrap";
import Snoowrap from "snoowrap";
import type { Timespan } from "snoowrap/dist/objects/Subreddit";
import strftime from "strftime";
import { mongoClient } from "../app.js";
import {
    EMBED_COLOUR,
    REDDIT_CLIENT_ID,
    REDDIT_CLIENT_SECRET,
    REDDIT_REFRESH_TOKEN,
} from "../config.js";

const RedditClient = new Snoowrap({
    userAgent: "linux:hifumi:v1.0.0 (by /u/tilted_toast)",
    clientId: REDDIT_CLIENT_ID,
    clientSecret: REDDIT_CLIENT_SECRET,
    refreshToken: REDDIT_REFRESH_TOKEN,
});

export async function profile(message: Message, prefix: string): Promise<Message> {
    const content = message.content.split(" ");

    if (content.length !== 2) return message.channel.send(`Usage: \`${prefix}profile <username>\``);

    // Make sure the provided username is valid
    // If it is, create an embed with the user's profile
    const userName = content[1].toLowerCase();
    const response = await fetch(`https://www.reddit.com/user/${userName}/about.json`);
    if (!response.ok) return await message.channel.send(`User not found!`);

    const profileEmbed = buildProfileEmbed(userName);

    return await message.channel.send({ embeds: [profileEmbed] });
}

function buildProfileEmbed(userName: string) {
    const { created_utc, name, comment_karma, link_karma, icon_img } =
        RedditClient.getUser(userName);

    const userCreatedDate = strftime("%d/%m/%Y", new Date(created_utc * 1000));
    const description = `[Link to profile](https://www.reddit.com/user/${name})
                        Post Karma: ${link_karma}
                        Comment Karma: ${comment_karma}
                        Created on: ${userCreatedDate}`;

    return new EmbedBuilder()
        .setColor(EMBED_COLOUR)
        .setTitle(`${name}'s profile`)
        .setDescription(description)
        .setThumbnail(icon_img);
}

export async function sub(message: Message, prefix: string): Promise<Message> {
    const content = message.content.split(" ").map((x) => x.toLowerCase());
    if (content.length === 1)
        return await message.channel.send(`Usage: \`${prefix}sub <subreddit>\``);

    const [isNSFW, force] = parseSubFlags(message);

    // Check if command has been run in a channel marked as NSFW to avoid potential NSFW posts in non-NSFW channels
    if (isNSFW && !(message.channel as TextChannel).nsfw)
        return await message.channel.send("You have to be in a NSFW channel for this");

    const subreddit = content[1];

    // Check if the subreddit exists
    const response = await fetch(`https://www.reddit.com/r/${subreddit}/about.json`);
    const data = (await response.json()) as Record<string, unknown>;

    if ("reason" in data)
        return await message.channel.send(`Subreddit not found! Reason: ${data["reason"]}`);

    if (!response.ok)
        return await message.channel.send(`Reddit's API might be having issues, try again later`);
    if (data["kind"] !== "t5") return await message.channel.send(`Subreddit not found`);

    const db = mongoClient.db("reddit");
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);

    if (force) {
        await message.channel.send("Force fetching images, this might take a while...");
        await fetchSubmissions(subreddit, message);
    } else if (!collectionNames.includes(subreddit)) {
        await message.channel.send(
            "Fetching images for the first time, this might take a while..."
        );
        await fetchSubmissions(subreddit, message);
    }

    const query = { over_18: isNSFW };

    // Get a random post that's stored in the database and send it via an Embed
    const collection = db.collection(subreddit);
    const randomSubmission = (await collection
        .aggregate([{ $match: query }, { $sample: { size: 1 } }])
        .toArray()) as Submission[];

    if (randomSubmission.length === 0) return await message.channel.send("No images found!");

    const [{ title, permalink, url }] = randomSubmission;

    const imgEmbed = new EmbedBuilder()
        .setColor(EMBED_COLOUR)
        .setTitle(title)
        .setURL(`https://reddit.com${permalink}`)
        .setImage(url);

    return await message.channel.send({ embeds: [imgEmbed] });
}

/**
 * Helper function that parses flag required for the sub command
 * @param message The message that triggered the command
 * @returns An array containing a boolean that indicated whether
 * to fetch NSFW posts or not and a boolean that indicates whether to force fetch posts or not
 */
function parseSubFlags(message: Message): [boolean, boolean] {
    let isNSFW = false,
        force = false;

    const content = message.content.toLowerCase().split(" ");

    for (let i = 2; i < content.length; i++) {
        if (content[i] === "nsfw") {
            isNSFW = true;
        } else if (content[i] === "force") {
            force = true;
        }
    }
    if ((message.channel as TextChannel).nsfw) isNSFW = true;

    return [isNSFW, force];
}

/**
 * Fetches submissions from every category within the specified subreddit and stores them in the database
 * @param subreddit The subreddit to fetch submissions from
 * @param message The message that triggered the command
 * @param limit The amount of submissions to fetch per category
 */
export async function fetchSubmissions(subreddit: string, message: Message, limit = 100) {
    const posts: Submission[] = [];
    const db = mongoClient.db("reddit");

    // Make sure there's a collection ready for the subreddit
    if (db.collection(subreddit) === null) await db.createCollection(subreddit);

    const collection = db.collection(subreddit);
    const submissionsArray = await getSubmissions(subreddit, limit);

    for (const submissionType of submissionsArray) {
        for (const submission of submissionType) {
            if (
                !submission.is_self &&
                (submission.url.includes("i.redd.it") || submission.url.includes("i.imgur.com"))
            ) {
                // This is on purpose, somehow it doesn't recognise submission
                // as json that can be put into the db
                posts.push(JSON.parse(JSON.stringify(submission)));
            }
        }
    }

    if (posts.length === 0) {
        return await message.channel.send("Couldn't find any new images");
    }

    await collection.insertMany(posts);
    return await message.channel.send(`Fetched ${posts.length} new images for ${subreddit}`);
}

async function getSubmissions(subreddit: string, limit: number) {
    const timeSpans: Timespan[] = ["hour", "day", "week", "month", "year", "all"];
    const subredditObject = RedditClient.getSubreddit(subreddit);

    const topSubmissions = timeSpans.map((time) => subredditObject.getTop({ time, limit }));

    return await Promise.all([
        subredditObject.getHot({ limit }),
        subredditObject.getNew({ limit }),
        subredditObject.getRising({ limit }),
        ...topSubmissions,
    ]);
}
