import Snoowrap from "snoowrap";
import { Message, MessageEmbed, TextChannel } from "discord.js";
import fetch from "node-fetch";
import { mongoClient } from "./app.js";
import strftime from "strftime";
import { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_REFRESH_TOKEN, EMBED_COLOUR } from "./config.js";
import { Timespan } from "snoowrap/dist/objects/Subreddit";

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

    const user = RedditClient.getUser(userName);
    const userCreatedDate = strftime("%d/%m/%Y", new Date(user.created_utc * 1000));
    const description = `[Link to profile](https://www.reddit.com/user/${user.name})
                        Post Karma: ${user.link_karma.toString()}
                        Comment Karma: ${user.comment_karma.toString()}
                        Created on: ${userCreatedDate}`;

    const profileEmbed = new MessageEmbed()
        .setColor(EMBED_COLOUR)
        .setTitle(`${user.name}'s profile`)
        .setDescription(description)
        .setThumbnail(user.icon_img);

    return await message.channel.send({ embeds: [profileEmbed] });
}

export async function sub(message: Message, prefix: string): Promise<Message> {
    let isNSFW = false,
        force = false;

    const content = message.content.split(" ").map((x) => x.toLowerCase());
    if (content.length === 1) return await message.channel.send(`Usage: \`${prefix}sub <subreddit>\``);

    if (content.length >= 3) {
        for (let i = 2; i < content.length; i++) {
            if (content[i] === "nsfw") {
                isNSFW = true;
            } else if (content[i] === "force") {
                force = true;
            }
        }
    }

    // Check if command has been run in a channel marked as NSFW to avoid potential NSFW posts in non-NSFW channels
    if (isNSFW && !(message.channel as TextChannel).nsfw)
        return await message.channel.send("You have to be in a NSFW channel for this");

    const subreddit = content[1];

    // Check if the subreddit exists
    const response = await fetch(`https://www.reddit.com/r/${subreddit}/about.json`);
    const data = (await response.json()) as Record<string, unknown>;

    if ("reason" in data) return await message.channel.send(`Subreddit not found! Reason: ${data.reason}`);

    if (!response.ok) return await message.channel.send(`Reddit's API might be having issues, try again later`);
    if (data["kind"] !== "t5") return await message.channel.send(`Subreddit not found`);

    const db = mongoClient.db("reddit");
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);

    if (force) {
        await message.channel.send("Force fetching images, this might take a while...");
        await fetchSubmissions(subreddit, message);
    } else if (!collectionNames.includes(subreddit)) {
        await message.channel.send("Fetching images for the first time, this might take a while...");
        await fetchSubmissions(subreddit, message);
    }

    const query = { over_18: isNSFW };

    // Get a random post that's stored in the database and send it via an Embed
    const collection = db.collection(subreddit);
    const randomSubmission = await collection.aggregate([{ $match: query }, { $sample: { size: 1 } }]).toArray();

    if (randomSubmission.length === 0) return await message.channel.send("No images found!");

    const submission = randomSubmission[0];

    const imgEmbed = new MessageEmbed()
        .setColor(EMBED_COLOUR)
        .setTitle(submission.title)
        .setURL(`https://reddit.com${submission.permalink}`)
        .setImage(submission.url);

    return await message.channel.send({ embeds: [imgEmbed] });
}

export async function fetchSubmissions(subreddit: string, message: Message, limit = 100) {
    const posts: Snoowrap.Submission[] = [];
    const db = mongoClient.db("reddit");

    // Make sure there's a collection ready for the subreddit
    if (db.collection(`${subreddit}`) === null) await db.createCollection(`${subreddit}`);

    const collection = db.collection(`${subreddit}`);
    const timeSpans: Timespan[] = ["hour", "day", "week", "month", "year", "all"];

    const topSubmissions = timeSpans.map((timeSpan) =>
        RedditClient.getSubreddit(subreddit).getTop({ time: timeSpan, limit: limit })
    );

    const submissionsArray = await Promise.all([
        RedditClient.getSubreddit(subreddit).getHot({ limit: limit }),
        RedditClient.getSubreddit(subreddit).getNew({ limit: limit }),
        RedditClient.getSubreddit(subreddit).getRising({ limit: limit }),
        ...topSubmissions,
    ]);

    for (const submissionType of submissionsArray) {
        for (const submission of submissionType) {
            if (
                (await collection.findOne({ id: submission.id })) === null &&
                !submission.is_self &&
                (submission.url.includes("i.redd.it") || submission.url.includes("i.imgur.com"))
            ) {
                // This is on purpose, somehow it doesn't recognise submission
                // as json that can be put into the db
                posts.push(JSON.parse(JSON.stringify(submission)));
            }
        }
    }

    await collection.insertMany(posts);
    await message.channel.send(`Fetched ${posts.length} new images for ${subreddit}`);
}
