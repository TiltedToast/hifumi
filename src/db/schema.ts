import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const errorLogs = sqliteTable("error_logs", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    server: text("server", { length: 255 }),
    channel: text("channel", { length: 255 }).notNull(),
    user: text("user", { length: 255 }).notNull(),
    command: text("command"),
    stack: text("stack"),
    timestamp: text("timestamp").default(sql`CURRENT_TIMESTAMP`),
    log: text("log"),
    error: text("error"),
});

export const helpMessages = sqliteTable("help_messages", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    cmd: text("cmd", { length: 100 }).notNull(),
    desc: text("desc", { length: 255 }).notNull(),
});

export const leet = sqliteTable("leet", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    source: text("source", { length: 1 }).notNull(),
    translated: text("translated", { length: 10 }).notNull(),
});

export const aiCommandAliases = sqliteTable("ai_command_aliases", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    command: text("command", { length: 255 }).notNull(),
    alias: text("alias", { length: 255 }).notNull(),
});

export const aiReactions = sqliteTable("ai_reactions", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    command: text("command", { length: 255 }).notNull(),
    reaction: text("reaction", { length: 255 }).notNull(),
});

export const prefixes = sqliteTable("prefixes", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    serverId: text("server_id", { length: 255 }).notNull().unique(),
    prefix: text("prefix", { length: 255 }).notNull(),
});

export const redditPosts = sqliteTable(
    "reddit_posts",
    {
        id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
        subreddit: text("subreddit", { length: 50 }).notNull(),
        title: text("title", { length: 255 }).notNull(),
        url: text("url", { length: 255 }).notNull(),
        over_18: integer("over_18", { mode: "boolean" }).notNull(),
        permalink: text("permalink", { length: 255 }).notNull(),
    },
    (table) => {
        return {
            subredditIdx: index("subreddit_idx").on(table.subreddit),
        };
    }
);

export const statuses = sqliteTable(
    "statuses",
    {
        id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
        type: text("type", {
            length: 20,
            enum: ["PLAYING", "WATCHING", "STREAMING", "LISTENING", "COMPETING", "CUSTOM"],
        }).notNull(),
        status: text("status", { length: 128 }).notNull(),
    },
    (table) => {
        return {
            idIdx: index("id").on(table.id),
            uniqueTypeStatus: unique("unique_type_status").on(table.type, table.status),
        };
    }
);
