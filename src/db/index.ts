import { connect } from "@planetscale/database";
import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/planetscale-serverless";
import { prefixes, redditPosts } from "./schema.js";
import { RedditPost } from "./types.js";

export const PSConnection = connect({ url: process.env.PLANETSCALE_URL, fetch });
export const db = drizzle(PSConnection, { logger: process.env.DEV_MODE === "true" });

/**
 * Queries the database for random posts from a subreddit. Defaults to 1 post.
 * @returns Random post(s) from the specified subreddit or an empty array if no posts were found
 * @example
 * const post = await getRandomRedditPost("awwnime");
 * console.log(post);
 * // => [{ subreddit: "awwnime", title: "Cute cat", url: "https://i.imgur.com/1234567.jpg", permalink: "/r/awwnime/1234567", over_18: false }]
 *
 * const post = await getRandomRedditPost("awwnime");
 * console.log(post);
 * // => []
 */
export async function getRandomRedditPost(subreddit: string, limit = 1): Promise<RedditPost[]> {
    return await db
        .select()
        .from(redditPosts)
        .where(eq(redditPosts.subreddit, subreddit))
        .orderBy(sql`RAND()`)
        .limit(limit);
}

/**
 * Updates the prefix for a server in the database
 * @param serverId The ID of the server
 * @param prefix The new prefix
 */
export async function updatePrefix(serverId: string, prefix: string) {
    await db.update(prefixes).set({ prefix }).where(eq(prefixes.serverId, serverId));
}
