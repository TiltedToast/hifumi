import { ChatInputCommandInteraction, EmbedBuilder, Message, TextChannel } from "discord.js";
import Snoowrap, { Subreddit } from "snoowrap";
import type { Timespan } from "snoowrap/dist/objects/Subreddit";
import strftime from "strftime";
import { EMBED_COLOUR, REDDIT_USER_AGENT } from "../config.js";
import { db, getRandomRedditPosts } from "../db/index.js";
import { redditPosts } from "../db/schema.js";
import { InsertRedditPostSchema, NewRedditPost, RedditPost } from "../db/types.js";
import { isCommandInteraction, randomElementFromArray, sendOrReply } from "../helpers/utils.js";

const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_REFRESH_TOKEN } = process.env;
const fetch_opts = { headers: { "User-Agent": REDDIT_USER_AGENT } };

const RedditClient = new Snoowrap({
    userAgent: REDDIT_USER_AGENT,
    clientId: REDDIT_CLIENT_ID,
    clientSecret: REDDIT_CLIENT_SECRET,
    refreshToken: REDDIT_REFRESH_TOKEN,
});

export async function profile(message: Message, prefix: string) {
    const content = message.content.split(" ");

    if (content.length !== 2) return message.channel.send(`Usage: \`${prefix}profile <username>\``);

    // Make sure the provided username is valid
    // If it is, create an embed with the user's profile
    const userName = content[1].toLowerCase();
    const response = await fetch(
        `https://www.reddit.com/user/${userName}/about.json`,
        fetch_opts
    ).catch(console.error);

    if (!response) {
        return await message.channel.send(`Reddit's API might be having issues, try again later`);
    }

    if (response.status == 404) {
        return await message.channel.send(`User not found!`);
    } else if (!response.ok) {
        return await message.channel.send(`Reddit's API might be having issues, try again later`);
    }
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

export async function sub(input: ChatInputCommandInteraction | Message) {
    const { isSFW, isNSFW, force } = parseSubFlags(input);

    if (isCommandInteraction(input)) await input.deferReply();

    // Check if command has been run in a channel marked as NSFW to avoid potential NSFW posts in non-NSFW channels
    if (isNSFW && !(input.channel as TextChannel).nsfw)
        return await sendOrReply(input, "You have to be in a NSFW channel for this");

    let subreddit: string;

    if (isCommandInteraction(input)) {
        subreddit = input.options.getString("subreddit", true).toLowerCase();
    } else {
        const content = input.content.split(" ");
        if (content.length === 1)
            return await sendOrReply(input, "You have to specify a subreddit");
        subreddit = content[1].toLowerCase();
    }

    // Check if the subreddit exists
    const response = await fetch(
        `https://www.reddit.com/r/${subreddit}/about.json`,
        fetch_opts
    ).catch(console.error);

    if (!response) {
        return await sendOrReply(
            input,
            `Couldn't grab subreddit info, Reddit's API is probably down so try again later`
        );
    }

    const json = (await response.json().catch(console.error)) as {
        data: Subreddit;
        reason?: string;
        kind: string;
    };

    if (!json) {
        return await sendOrReply(
            input,
            `Reddit returned an invalid response, probably something broke with their API.\nHTTP ${response.status}: ${response.statusText}`
        );
    }

    if (!isNSFW && json.data.over18) {
        return await sendOrReply(input, "You have to be in a NSFW channel for this");
    }

    if ("reason" in json) {
        return await sendOrReply(input, `Subreddit not found! Reason: ${json.reason}`);
    }

    if (response.status === 404 || json.kind !== "t5") {
        return await sendOrReply(input, `Subreddit not found`);
    }

    if (!response.ok) {
        return await sendOrReply(input, `Reddit's API might be having issues, try again later`);
    }

    const posts = await getRandomRedditPosts(subreddit);

    try {
        if (force) {
            await input.channel?.send("Force fetching images, this might take a while...");
            posts.push(...(await fetchSubmissions(subreddit, input)));
        } else if (!posts.length) {
            await input.channel?.send(
                "Fetching images for the first time, this might take a while..."
            );
            posts.push(...(await fetchSubmissions(subreddit, input)));
        }
    } catch (error) {
        console.error(error);
        return await sendOrReply(input, `Reddit's API might be having issues, try again later`);
    }

    const filtered_posts = isNSFW && !isSFW ? posts.filter((x) => !!x.over_18) : posts;

    if (filtered_posts.length === 0) return await sendOrReply(input, "No images found!");

    const { title, permalink, url } = randomElementFromArray(filtered_posts);

    const imgEmbed = new EmbedBuilder()
        .setColor(EMBED_COLOUR)
        .setTitle(title)
        .setURL(`https://reddit.com${permalink}`)
        .setImage(url);

    return await sendOrReply(input, { embeds: [imgEmbed] });
}

/**
 * Helper function that parses flag required for the sub command
 * @param message The message that triggered the command
 * @returns An array containing a boolean that indicated whether
 * to fetch NSFW posts or not and a boolean that indicates whether to force fetch posts or not
 */
function parseSubFlags(input: ChatInputCommandInteraction | Message): {
    isSFW: boolean;
    isNSFW: boolean;
    force: boolean;
} {
    let isSFW = true,
        isNSFW = false,
        force = false;

    if (isCommandInteraction(input)) {
        if (input.options.getBoolean("nsfw")) {
            isNSFW = true;
            isSFW = false;
        } else if (input.options.getBoolean("force")) {
            force = true;
        }
    } else {
        const content = input.content.split(" ");
        if (content.includes("nsfw")) {
            isNSFW = true;
            isSFW = false;
        } else if (content.includes("force")) {
            force = true;
        }
    }
    if ((input.channel as TextChannel).nsfw) isNSFW = true;

    return { isSFW, isNSFW, force };
}

/**
 * Fetches submissions from every category within the specified subreddit and stores them in the database
 * @param subreddit The subreddit to fetch submissions from
 * @param message The message that triggered the command
 * @param limit The amount of submissions to fetch per category
 */
async function fetchSubmissions(
    subreddit: string,
    input: ChatInputCommandInteraction | Message,
    limit = 100
): Promise<RedditPost[]> {
    const posts = new Array<NewRedditPost>();

    const submissionsArray = await getSubmissions(subreddit, limit);

    for (const submissionType of submissionsArray) {
        for (const submission of submissionType) {
            if (await isValidSubmission(submission)) {
                const post = {
                    subreddit: submission.subreddit.display_name,
                    title: submission.title,
                    url: submission.url,
                    permalink: submission.permalink,
                    over_18: submission.over_18,
                };

                if (
                    !posts.some((x) => x.url === post.url) &&
                    InsertRedditPostSchema.safeParse(post).success
                )
                    posts.push(post);
            }
        }
    }

    if (posts.length === 0) {
        await input.channel?.send("Couldn't find any new images");
        return [];
    }

    await db.insert(redditPosts).values(posts);
    await input.channel?.send(`Fetched ${posts.length} new images for ${subreddit}`);
    return posts as RedditPost[];
}

function isFulfilled<T>(p: PromiseSettledResult<T>): p is PromiseFulfilledResult<T> {
    return p.status === "fulfilled";
}

async function getSubmissions(subreddit: string, limit: number) {
    const timeSpans: Timespan[] = ["hour", "day", "week", "month", "year", "all"];
    const subredditObject = RedditClient.getSubreddit(subreddit);

    const topSubmissions = timeSpans.map((time) => subredditObject.getTop({ time, limit }));

    return await Promise.allSettled([
        subredditObject.getHot({ limit }),
        subredditObject.getNew({ limit }),
        subredditObject.getRising({ limit }),
        ...topSubmissions,
    ]).then((results) => results.filter(isFulfilled).map((p) => p.value));
}

async function isValidSubmission(submission: Snoowrap.Submission): Promise<boolean> {
    if (submission.is_self) return false;
    if (submission.url.includes("i.redd.it")) return true;

    const regex = /^https:\/\/i\.imgur\.com\/([\w\d]+)\./;

    if (!submission.url.includes("i.imgur.com")) return false;

    const id = submission.url.match(regex)?.[1];
    if (!id) return false;

    const response = await fetch(`https://api.imgur.com/3/image/${id}`, {
        headers: {
            Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}`,
        },
    }).catch(console.error);

    return !!response?.ok;
}
