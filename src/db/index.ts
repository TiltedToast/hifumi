import { createClient } from "@libsql/client";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { prefixes, redditPosts } from "./schema.ts";
import type { NewRedditPost, RedditPost } from "./types.ts";

const { TURSO_AUTH_TOKEN, TURSO_DATABASE_URL, DEV_MODE } = process.env;

export const dbClient = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
export const db = drizzle(dbClient, { logger: DEV_MODE === "true" });

const randomPostQuery = db
    .select()
    .from(redditPosts)
    .where(eq(redditPosts.subreddit, sql.placeholder("subreddit")))
    .orderBy(sql`RANDOM()`)
    .limit(1)
    .prepare();

export async function existsPost(post: NewRedditPost): Promise<boolean> {
    return (
        (
            await db
                .select({ url: redditPosts.url })
                .from(redditPosts)
                .where(eq(redditPosts.url, post.url))
        ).length > 0
    );
}

/**
 * Queries the database for random posts from a subreddit. Defaults to 1 post.
 * @returns Random post from the specified subreddit or an empty array if no posts were found
 */
export async function getRandomRedditPost(subreddit: string): Promise<RedditPost[]> {
    return await randomPostQuery.execute({ subreddit });
}

/**
 * Updates the prefix for a server in the database
 * @param serverId The ID of the server
 * @param prefix The new prefix
 */
export async function updatePrefix(serverId: string, prefix: string) {
    return await db
        .update(prefixes)
        .set({ prefix })
        .where(eq(prefixes.serverId, serverId))
        .catch(console.error);
}

/**
 * Inserts a new prefix for a server into the database
 * @param serverId The ID of the server
 * @param prefix The new prefix
 */
export async function insertPrefix(serverId: string, prefix: string) {
    return await db.insert(prefixes).values({ serverId, prefix }).catch(console.error);
}

/**
 * Performs the database migration, if it fails we exit with code 1
 */
export async function migrateDb() {
    await migrate(db, { migrationsFolder: "./src/db/migrations" }).catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
