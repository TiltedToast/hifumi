import { boolean, index, int, mysqlTable, varchar } from "drizzle-orm/mysql-core";

const redditPosts = mysqlTable(
    "reddit_posts",
    {
        id: int("id").autoincrement().primaryKey(),
        subreddit: varchar("subreddit", { length: 50 }).notNull(),
        title: varchar("title", { length: 255 }).notNull(),
        url: varchar("url", { length: 255 }).notNull(),
        over_18: boolean("over_18").notNull(),
        permalink: varchar("permalink", { length: 255 }).notNull(),
    },
    (table) => {
        return {
            subredditIdx: index("subreddit_idx").on(table.subreddit),
        };
    }
);

export default redditPosts;
