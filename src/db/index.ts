import { createClient } from "@libsql/client";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.ts";
import { prefixes, redditPosts } from "./schema.ts";
import type { RedditPost } from "./types.ts";

const { TURSO_AUTH_TOKEN, TURSO_DATABASE_URL, DEV_MODE } = process.env;

export const dbClient = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
export const db = drizzle(dbClient, { logger: DEV_MODE === "true", schema });

const randomPostQuery = db
    .select()
    .from(redditPosts)
    .where(eq(redditPosts.subreddit, sql.placeholder("subreddit")))
    .orderBy(sql`RANDOM()`)
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

/**
 * Inserts a new prefix for a server into the database
 * @param serverId The ID of the server
 * @param prefix The new prefix
 */
export async function insertPrefix(serverId: string, prefix: string) {
    await db.insert(prefixes).values({ serverId, prefix });
}
