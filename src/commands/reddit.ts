import {
    ChannelType,
    type ChatInputCommandInteraction,
    EmbedBuilder,
    type Message,
    type TextChannel,
} from "discord.js";
import Snoowrap from "snoowrap";
import type { Timespan } from "snoowrap/dist/objects/Subreddit.js";
import { EMBED_COLOUR, REDDIT_USER_AGENT } from "../config.ts";
import { db, existsPost, getRandomRedditPost } from "../db/index.ts";
import { redditPosts } from "../db/schema.ts";
import { InsertRedditPostSchema, type NewRedditPost, type RedditPost } from "../db/types.ts";
import { SubredditInfoSchema, type SubredditInfo } from "../helpers/types.ts";
import {
    isChatInputCommandInteraction,
    randomElementFromArray,
    sendOrReply,
} from "../helpers/utils.ts";

const fetch_opts = { headers: { "User-Agent": REDDIT_USER_AGENT } };

const RedditClient = new Snoowrap({
    userAgent: REDDIT_USER_AGENT,
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    refreshToken: process.env.REDDIT_REFRESH_TOKEN,
});

export async function sub(input: ChatInputCommandInteraction | Message) {
    return sendOrReply(input, "This command is disabled for now, sorry!");

    // @ts-expect-error
    if (isChatInputCommandInteraction(input)) await input.deferReply({ ephemeral: true });

    const { isSFW, isNSFW, force } = parseSubFlags(input);

    let msg: Message | null = null;

    if (
        isNSFW &&
        (input.channel as TextChannel).type !== ChannelType.GuildText &&
        input.channel?.type !== ChannelType.DM
    ) {
        return await sendOrReply(input, "You have to be in a NSFW channel for this");
    }

    let subreddit: string;

    if (isChatInputCommandInteraction(input)) {
        // @ts-expect-error
        subreddit = input.options.getString("subreddit", true).toLowerCase();
    } else {
        // @ts-expect-error
        const content = input.content.split(" ").filter(Boolean);
        if (content.length === 1) {
            return await sendOrReply(input, "You have to specify a subreddit");
        }
        subreddit = content[1]!.toLowerCase();
    }

    // Check if the subreddit exists
    const response = await fetch(
        `https://www.reddit.com/r/${subreddit}/about.json`,
        fetch_opts
    ).catch(console.error);

    if (!response) {
        return await sendOrReply(
            input,
            `Couldn't grab subreddit info, Reddit's API is probably being petty again so try later maybe`
        );
    }

    // @ts-expect-error
    const json = (await response.json().catch(console.error)) as SubredditInfo;

    if (!SubredditInfoSchema.safeParse(json).success || !json) {
        return await sendOrReply(
            input,
            // @ts-expect-error
            `Reddit returned an invalid response, probably something broke with their API.\nHTTP ${response.status}: ${response.statusText}`
        );
    }

    if (!isNSFW && json.data.over18) {
        return await sendOrReply(input, "You have to be in a NSFW channel for this");
    }

    if ("reason" in json) {
        return await sendOrReply(input, `Subreddit not found! Reason: ${json.reason}`);
    }

    // @ts-expect-error
    if (response.status === 404 || json.kind !== "t5") {
        return await sendOrReply(input, "Subreddit not found");
    }

    // @ts-expect-error
    if (!response.ok) {
        return await sendOrReply(input, `Reddit's API might be having issues, try again later`);
    }

    const posts = await getRandomRedditPost(subreddit);

    try {
        if (force) {
            msg = await notifyUser(input, msg, "Force fetching images, this might take a while...");
            posts.push(...(await fetchSubmissions(subreddit, input, msg)));
        } else if (!posts.length) {
            msg = await notifyUser(
                input,
                msg,
                "Fetching images for the first time, this might take a while..."
            );
            posts.push(...(await fetchSubmissions(subreddit, input, msg)));
        }
    } catch (error) {
        console.error(error);
        return await sendOrReply(input, `Reddit's API might be having issues, try again later`);
    }

    const filtered_posts = isNSFW && !isSFW ? posts.filter((x) => x.over_18) : posts;

    if (filtered_posts.length === 0) return await sendOrReply(input, "No images found!");

    const { title, permalink, url } = randomElementFromArray(filtered_posts);

    const imgEmbed = new EmbedBuilder()
        .setColor(EMBED_COLOUR)
        .setTitle(title)
        .setURL(`https://reddit.com${permalink}`)
        .setImage(url);

    if (isChatInputCommandInteraction(input)) {
        // @ts-expect-error
        await input.editReply({ embeds: [imgEmbed] });
    } else if (msg?.editable) {
        // @ts-expect-error
        await msg.edit({ embeds: [imgEmbed] });
    } else {
        await input.channel?.send({ embeds: [imgEmbed] });
    }
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
    let isSFW = true;
    let isNSFW = false;
    let force = false;

    if (isChatInputCommandInteraction(input)) {
        if (input.options.getBoolean("nsfw")) {
            isNSFW = true;
            isSFW = false;
        }
        if (input.options.getBoolean("force")) {
            force = true;
        }
    } else {
        const content = input.content.split(" ").filter(Boolean);
        if (content.includes("nsfw")) {
            isNSFW = true;
            isSFW = false;
        }
        if (content.includes("force")) {
            force = true;
        }
    }
    // biome-ignore format: this is easier to read
    if (
        (input.channel as TextChannel).nsfw ||
        input.channel?.type === ChannelType.DM
    ) {
        isNSFW = true;
    }

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
    msg: Message | null = null,
    limit = 100
): Promise<RedditPost[]> {
    const posts = new Map<string, NewRedditPost>();

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
                // biome-ignore format: this is easier to follow
                if (
                    InsertRedditPostSchema.safeParse(post).success &&
                    !await existsPost(post)
                ) {
                    posts.set(post.url, post);
                }
            }
        }
    }

    if (posts.size === 0) {
        msg = await notifyUser(input, msg, "Couldn't find any new images");
        return [];
    }

    const postsArray = Array.from(posts.values());

    const result = await db.insert(redditPosts).values(postsArray).catch(console.error);

    if (!result) {
        msg = await notifyUser(input, msg, "Couldn't save images to the database");
        return [];
    }

    await notifyUser(input, msg, `Fetched ${posts.size} new images for ${subreddit}`);

    return postsArray as RedditPost[];
}

async function notifyUser(
    input: ChatInputCommandInteraction | Message,
    message: Message | null,
    payload: string
): Promise<Message> {
    if (isChatInputCommandInteraction(input)) {
        return await input.editReply(payload);
    }
    if (message?.editable) {
        return await message.edit(payload);
    }
    return await input.channel?.send(payload);
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
    ]).then((results) => results.filter((p) => p.status === "fulfilled").map((p) => p.value));
}

async function isValidSubmission(submission: Snoowrap.Submission): Promise<boolean> {
    if (submission.is_self) return false;
    if (submission.url.includes("i.redd.it")) return true;

    const regex = /^https:\/\/i\.imgur\.com\/([\w\d]+)\./;

    const id = submission.url.match(regex)?.[1];
    if (!id) return false;

    const response = await fetch(`https://api.imgur.com/3/image/${id}`, {
        headers: {
            Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}`,
        },
    }).catch(console.error);

    return !!response?.ok;
}
