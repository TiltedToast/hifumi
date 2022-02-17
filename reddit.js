import * as tools from './tools.js';
import { credentials } from './config.js'
import Snoowrap from 'snoowrap';
import { MessageEmbed } from "discord.js";
import fetch from 'node-fetch';
import { mongoClient, embedColour } from './app.js';


const RedditClient = new Snoowrap({
    userAgent: 'windows:hifumi:v1.0.0 (by /u/tilted_toast)',
    clientId: credentials['redditClientId'],
    clientSecret: credentials['redditClientSecret'],
    refreshToken: credentials['redditRefreshToken']
});

export async function profile(message, prefix) {
    const content = message.content.split(" ");

    if (content.length !== 2) {
        return message.channel.send(`Usage: \`${prefix}profile <username>\``);
    }

    const userName = content[1].toLowerCase();
    const response = await fetch(`https://www.reddit.com/user/${userName}/about.json`)
    if (!response.ok) { return await message.channel.send(`User not found!`) }

    const user = await RedditClient.getUser(userName).fetch()
    const userCreatedDate = tools.strftime("%d/%m/%Y", new Date(user.created_utc * 1000));
    const description = `[Link to profile](https://www.reddit.com/user/${user.name})
                        Post Karma: ${user.link_karma.toLocaleString()}
                        Comment Karma: ${user.comment_karma.toLocaleString()}
                        Created on: ${userCreatedDate}`;

    const profileEmbed = new MessageEmbed()
        .setColor(embedColour)
        .setTitle(`${user.name}'s profile`)
        .setDescription(description)
        .setThumbnail(user.icon_img)

    await message.channel.send({ embeds: [profileEmbed] });
}


export async function sub(message, prefix) {
    let nsfw = false;
    let force = false;
    let query;

    const content = message.content.split(" ").map(x => x.toLowerCase());

    if (content.length === 1) {
        return await message.channel.send(`Usage: \`${prefix}sub <subreddit>\``);
    } else if (content.length === 3) {
        if (content[2] === 'nsfw') {
            nsfw = true;
        } else if (content[2] === 'force') {
            force = true;
        } else {
            return await message.channel.send(`Usage: \`${prefix}sub <subreddit> [nsfw/force]\``);
        }
    } else if (content.length === 4) {
        if (content[3] === "force") {
            force = true;
        } else {
            return await message.channel.send(`Usage: \`${prefix}sub <subreddit> [nsfw] [force]\``);
        }
    } else {
        return await message.channel.send(`Usage: \`${prefix}sub <subreddit> [nsfw] [force]\``);
    }

    const subreddit = content[1];

    const res = await fetch(`https://www.reddit.com/r/${subreddit}/about.json`);
    if (!res.ok) { return await message.channel.send(`Subreddit not found!`) }


    const db = mongoClient.db('reddit');
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    if (force) {
        await message.channel.send('Force fetching images, this might take a while...');
        await fetchSubmissions(subreddit);

    } else if (!collectionNames.includes(subreddit)) {
        await message.channel.send('Fetching images for the first time, this might take a while...');
        await fetchSubmissions(subreddit);
    }

    if (nsfw) {
        query = { over_18: true }
    } else {
        query = { over_18: false }
    }

    const collection = db.collection(subreddit);
    const randomSubmission = await collection.aggregate([
        { $match: query },
        { $sample: { size: 1 } }
    ]).toArray();

    if (randomSubmission.length === 0) {
        return await message.channel.send('No images found!');
    }

    const submission = JSON.parse(JSON.stringify(randomSubmission[0]));

    const imgEmbed = new MessageEmbed()
        .setColor(embedColour)
        .setTitle(submission.title)
        .setURL(`https://reddit.com${submission.permalink}`)
        .setImage(submission.url)

    await message.channel.send({ embeds: [imgEmbed] });


}

export async function fetchSubmissions(subreddit, limit = 100) {
    let insertedCount = 0;
    const db = mongoClient.db('reddit');

    if (db.collection(`${subreddit}`) === null) {
        await db.createCollection(`${subreddit}`);
    }

    const collection = db.collection(`${subreddit}`);

    const hotSubmissions = await RedditClient.getSubreddit(subreddit).getHot({ limit: limit })
    for (let submission of hotSubmissions) {
        if (await collection.findOne({ id: submission.id }) === null && !submission.is_self
            && (submission.url.includes("i.redd.it") || submission.url.includes("i.imgur.com"))) {
            await collection.insertOne(JSON.parse(JSON.stringify(submission)));
            insertedCount += 1;
        }
    }

    const newSubmissions = await RedditClient.getSubreddit(subreddit).getNew({ limit: limit })
    for (let submission of newSubmissions) {
        if (await collection.findOne({ id: submission.id }) === null && !submission.is_self
            && (submission.url.includes("i.redd.it") || submission.url.includes("i.imgur.com"))) {
            await collection.insertOne(JSON.parse(JSON.stringify(submission)));
            insertedCount += 1;
        }
    }

    const risingSubmissions = await RedditClient.getSubreddit(subreddit).getRising({ limit: limit })
    for (let submission of risingSubmissions) {
        if (await collection.findOne({ id: submission.id }) === null && !submission.is_self
            && (submission.url.includes("i.redd.it") || submission.url.includes("i.imgur.com"))) {
            await collection.insertOne(JSON.parse(JSON.stringify(submission)));
            insertedCount += 1;
        }
    }


    await tools.fetchTopPosts(subreddit, 'hour', insertedCount, db, RedditClient);
    await tools.fetchTopPosts(subreddit, 'day', insertedCount, db, RedditClient);
    await tools.fetchTopPosts(subreddit, 'week', insertedCount, db, RedditClient);
    await tools.fetchTopPosts(subreddit, 'month', insertedCount, db, RedditClient);
    await tools.fetchTopPosts(subreddit, 'year', insertedCount, db, RedditClient);
    await tools.fetchTopPosts(subreddit, 'all', insertedCount, db, RedditClient);
}