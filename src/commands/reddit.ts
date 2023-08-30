import { ChatInputCommandInteraction, EmbedBuilder, Message, TextChannel } from "discord.js";
import Snoowrap from "snoowrap";
import type { Timespan } from "snoowrap/dist/objects/Subreddit";
import strftime from "strftime";
import { prefixMap } from "../app.js";
import { DEFAULT_PREFIX, DEV_PREFIX, EMBED_COLOUR } from "../config.js";
import { db, getRandomRedditPosts } from "../db/index.js";
import { redditPosts } from "../db/schema.js";
import { InsertRedditPostSchema, NewRedditPost, RedditPost } from "../db/types.js";
import { isDev, randomElementFromArray } from "../helpers/utils.js";

const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_REFRESH_TOKEN } = process.env;

const RedditClient = new Snoowrap({
    userAgent: "linux:hifumi:v1.0.0 (by /u/tilted_toast)",
    clientId: REDDIT_CLIENT_ID,
    clientSecret: REDDIT_CLIENT_SECRET,
    refreshToken: REDDIT_REFRESH_TOKEN,
});

export async function profile(message: Message): Promise<Message> {
    const content = message.content.split(" ");

    const prefix = isDev() ? DEV_PREFIX : prefixMap.get(message.guildId ?? "") ?? DEFAULT_PREFIX;

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

export async function sub(interaction: ChatInputCommandInteraction) {
    const [isSFW, isNSFW, force] = parseSubFlags(interaction);

    await interaction.deferReply();

    // Check if command has been run in a channel marked as NSFW to avoid potential NSFW posts in non-NSFW channels
    if (isNSFW && !(interaction.channel as TextChannel).nsfw)
        return await interaction.editReply("You have to be in a NSFW channel for this");

    const subreddit = interaction.options.getString("subreddit", true).toLowerCase();

    // Check if the subreddit exists
    const response = await fetch(`https://www.reddit.com/r/${subreddit}/about.json`);

    let data: Record<string, string>;

    try {
        data = (await response.json()) as Record<string, string>;
    } catch (_) {
        return await interaction.editReply(`Reddit's API might be having issues, try again later`);
    }

    if ("reason" in data)
        return await interaction.editReply(`Subreddit not found! Reason: ${data["reason"]}`);

    if (response.status === 404) return await interaction.editReply(`Subreddit not found`);

    if (!response.ok)
        return await interaction.editReply(`Reddit's API might be having issues, try again later`);

    const posts = await getRandomRedditPosts(subreddit);

    try {
        if (force) {
            await interaction.channel?.send("Force fetching images, this might take a while...");
            posts.push(...(await fetchSubmissions(subreddit, interaction)));
        } else if (!posts.length) {
            await interaction.channel?.send(
                "Fetching images for the first time, this might take a while..."
            );
            posts.push(...(await fetchSubmissions(subreddit, interaction)));
        }
    } catch (error) {
        console.error(error);
        return await interaction.editReply(`Reddit's API might be having issues, try again later`);
    }

    const filtered_posts = isNSFW && !isSFW ? posts.filter((x) => !!x.over_18) : posts;

    if (filtered_posts.length === 0) return await interaction.editReply("No images found!");

    const { title, permalink, url } = randomElementFromArray(filtered_posts);

    const imgEmbed = new EmbedBuilder()
        .setColor(EMBED_COLOUR)
        .setTitle(title)
        .setURL(`https://reddit.com${permalink}`)
        .setImage(url);

    return await interaction.editReply({ embeds: [imgEmbed] });
}

/**
 * Helper function that parses flag required for the sub command
 * @param message The message that triggered the command
 * @returns An array containing a boolean that indicated whether
 * to fetch NSFW posts or not and a boolean that indicates whether to force fetch posts or not
 */
function parseSubFlags(interaction: ChatInputCommandInteraction): [boolean, boolean, boolean] {
    let isSFW = true,
        isNSFW = false,
        force = false;

    if (interaction.options.getBoolean("nsfw")) {
        isNSFW = true;
        isSFW = false;
    } else if (interaction.options.getBoolean("force")) {
        force = true;
    }
    if ((interaction.channel as TextChannel).nsfw) isNSFW = true;

    return [isSFW, isNSFW, force];
}

/**
 * Fetches submissions from every category within the specified subreddit and stores them in the database
 * @param subreddit The subreddit to fetch submissions from
 * @param message The message that triggered the command
 * @param limit The amount of submissions to fetch per category
 */
async function fetchSubmissions(
    subreddit: string,
    interaction: ChatInputCommandInteraction,
    limit = 100
): Promise<RedditPost[]> {
    const posts = new Array<NewRedditPost>();

    const submissionsArray = await getSubmissions(subreddit, limit);

    for (const submissionType of submissionsArray) {
        for (const submission of submissionType) {
            if (
                !submission.is_self &&
                (submission.url.includes("i.redd.it") || submission.url.includes("i.imgur.com"))
            ) {
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
        await interaction.channel?.send("Couldn't find any new images");
        return [];
    }

    await db.insert(redditPosts).values(posts);
    await interaction.channel?.send(`Fetched ${posts.length} new images for ${subreddit}`);
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
