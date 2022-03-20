import Snoowrap from "snoowrap";
import { Message, MessageEmbed, TextChannel } from "discord.js";
import fetch from "node-fetch";
import { mongoClient, embedColour } from "./app.js";
import strftime from "strftime";

const RedditClient = new Snoowrap({
    userAgent: "windows:hifumi:v1.0.0 (by /u/tilted_toast)",
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    refreshToken: process.env.REDDIT_REFRESH_TOKEN,
});

export async function profile(message: Message, prefix: string): Promise<Message> {
    const content = message.content.split(" ");

    if (content.length !== 2) {
        return message.channel.send(`Usage: \`${prefix}profile <username>\``);
    }

    // Make sure the provided username is valid
    // If it is, create an embed with the user's profile
    const userName = content[1].toLowerCase();
    const response = await fetch(`https://www.reddit.com/user/${userName}/about.json`);
    if (!response.ok) {
        return await message.channel.send(`User not found!`);
    }

    const user = RedditClient.getUser(userName);
    const userCreatedDate = strftime("%d/%m/%Y", new Date(user.created_utc * 1000));
    const description = `[Link to profile](https://www.reddit.com/user/${user.name})
                        Post Karma: ${user.link_karma.toLocaleString()}
                        Comment Karma: ${user.comment_karma.toLocaleString()}
                        Created on: ${userCreatedDate}`;

    const profileEmbed = new MessageEmbed()
        .setColor(embedColour)
        .setTitle(`${user.name}'s profile`)
        .setDescription(description)
        .setThumbnail(user.icon_img);

    return await message.channel.send({ embeds: [profileEmbed] });
}

export async function sub(message: Message, prefix: string): Promise<Message> {
    let nsfw = false,
        force = false,
        query: object;

    const content = message.content.split(" ").map((x) => x.toLowerCase());

    // Set the value for the nsfw & force flags
    if (content.length === 1) {
        return await message.channel.send(`Usage: \`${prefix}sub <subreddit>\``);
    } else if (content.length === 3) {
        if (content[2] === "nsfw") {
            nsfw = true;
        } else if (content[2] === "force") {
            force = true;
        } else {
            return await message.channel.send(`Usage: \`${prefix}sub <subreddit> [nsfw/force]\``);
        }
    } else if (content.length >= 4) {
        if (content[3] === "force") {
            force = true;
        } else {
            return await message.channel.send(`Usage: \`${prefix}sub <subreddit> [nsfw] [force]\``);
        }
    }

    // Check if command has been run in a channel marked as NSFW to avoid potential NSFW posts in non-NSFW channels
    if (nsfw && !(message.channel as TextChannel).nsfw)
        return await message.channel.send("You have to be in a NSFW channel for this");

    const subreddit: string = content[1];

    // Check if the subreddit exists
    const res = await fetch(`https://www.reddit.com/r/${subreddit}/about.json`);
    if (!res.ok) {
        return await message.channel.send(`Subreddit not found!`);
    }

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

    // If true, looks for only NSFW posts
    // If false, looks for only SFW posts
    if (nsfw) {
        query = { over_18: true };
    } else {
        query = { over_18: false };
    }

    // Get a random post that's stored in the database and send it via an Embed
    const collection = db.collection(subreddit);
    const randomSubmission = await collection.aggregate([{ $match: query }, { $sample: { size: 1 } }]).toArray();

    if (randomSubmission.length === 0) {
        return await message.channel.send("No images found!");
    }

    const submission = JSON.parse(JSON.stringify(randomSubmission[0]));

    const imgEmbed = new MessageEmbed()
        .setColor(embedColour)
        .setTitle(submission.title)
        .setURL(`https://reddit.com${submission.permalink}`)
        .setImage(submission.url);

    return await message.channel.send({ embeds: [imgEmbed] });
}

export async function fetchSubmissions(subreddit: string, message: Message, limit = 100) {
    let counter = 0;
    const db = mongoClient.db("reddit");

    // Make sure there's a collection ready for the subreddit
    if (db.collection(`${subreddit}`) === null) {
        await db.createCollection(`${subreddit}`);
    }

    const collection = db.collection(`${subreddit}`);

    // Fetches posts from the subreddit based on the limit (default 100) and stores them in the database
    // Only fetches posts that are hosted on reddit/imgur to avoid Embeds not loading
    const hotSubmissions = RedditClient.getSubreddit(subreddit).getHot({ limit: limit });
    const newSubmissions = RedditClient.getSubreddit(subreddit).getNew({ limit: limit });
    const risingSubmissions = RedditClient.getSubreddit(subreddit).getRising({ limit: limit });
    const topHour = RedditClient.getSubreddit(subreddit).getTop({ time: "hour", limit: limit });
    const topDay = RedditClient.getSubreddit(subreddit).getTop({ time: "day", limit: limit });
    const topweek = RedditClient.getSubreddit(subreddit).getTop({ time: "week", limit: limit });
    const topmonth = RedditClient.getSubreddit(subreddit).getTop({ time: "month", limit: limit });
    const topyear = RedditClient.getSubreddit(subreddit).getTop({ time: "year", limit: limit });
    const topAll = RedditClient.getSubreddit(subreddit).getTop({ time: "all", limit: limit });

    const submissionsArray = await Promise.all([
        hotSubmissions,
        newSubmissions,
        risingSubmissions,
        topHour,
        topDay,
        topweek,
        topmonth,
        topyear,
        topAll,
    ]);

    for (const submissionType of submissionsArray) {
        for (const submission of submissionType) {
            if (
                (await collection.findOne({ id: submission.id })) === null &&
                !submission.is_self &&
                (submission.url.includes("i.redd.it") || submission.url.includes("i.imgur.com"))
            ) {
                await collection.insertOne(JSON.parse(JSON.stringify(submission)));
                counter++;
            }
        }
    }

    await message.channel.send(`Fetched ${counter} new images for ${subreddit}`);
}
