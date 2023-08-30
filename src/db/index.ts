import { connect } from "@planetscale/database";
import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/planetscale-serverless";
import * as schema from "./schema.js";
import { prefixes, redditPosts } from "./schema.js";
import { RedditPost } from "./types.js";

const { PLANETSCALE_URL, DEV_MODE } = process.env;

export const PSConnection = connect({ url: PLANETSCALE_URL, fetch });
export const db = drizzle(PSConnection, { logger: DEV_MODE === "true", schema });

const randomPostQuery = db
    .select()
    .from(redditPosts)
    .where(eq(redditPosts.subreddit, sql.placeholder("subreddit")))
    .orderBy(sql`RAND()`)
    .limit(1)
    .prepare();

/**
 * Queries the database for random posts from a subreddit. Defaults to 1 post.
 * @returns Random post from the specified subreddit or an empty array if no posts were found
 */
export async function getRandomRedditPosts(subreddit: string): Promise<RedditPost[]> {
    return await randomPostQuery.execute({ subreddit });
}

/**
 * Updates the prefix for a server in the database
 * @param serverId The ID of the server
 * @param prefix The new prefix
 */
export async function updatePrefix(serverId: string, prefix: string) {
    await db.update(prefixes).set({ prefix }).where(eq(prefixes.serverId, serverId));
}
