import {
    boolean,
    char,
    index,
    int,
    mysqlTable,
    primaryKey,
    text,
    timestamp,
    uniqueIndex,
    varchar,
} from "drizzle-orm/mysql-core/index.js";

export const currencies = mysqlTable("currencies", {
    id: int("id").autoincrement().primaryKey().notNull(),
    code: char("code", { length: 3 }).notNull(),
    longName: varchar("long_name", { length: 50 }).notNull(),
});

export const errorLogs = mysqlTable("error_logs", {
    id: int("id").autoincrement().primaryKey().notNull(),
    server: varchar("server", { length: 50 }),
    channel: varchar("channel", { length: 50 }).notNull(),
    user: varchar("user", { length: 50 }).notNull(),
    command: text("command"),
    stack: text("stack"),
    timestamp: timestamp("timestamp", { mode: "string" }).defaultNow(),
    log: text("log"),
    error: text("error"),
});

export const helpMessages = mysqlTable("help_messages", {
    id: int("id").autoincrement().primaryKey().notNull(),
    cmd: varchar("cmd", { length: 255 }).notNull(),
    desc: varchar("desc", { length: 255 }).notNull(),
});

export const leet = mysqlTable("leet", {
    id: int("id").autoincrement().primaryKey().notNull(),
    source: char("source", { length: 1 }).notNull(),
    translated: varchar("translated", { length: 50 }).notNull(),
});

export const mikuReactionAliases = mysqlTable("miku_reaction_aliases", {
    id: int("id").autoincrement().primaryKey().notNull(),
    command: varchar("command", { length: 50 }).notNull(),
    alias: varchar("alias", { length: 50 }).notNull(),
});

export const mikuReactions = mysqlTable("miku_reactions", {
    id: int("id").autoincrement().primaryKey().notNull(),
    command: varchar("command", { length: 50 }).notNull(),
    reaction: varchar("reaction", { length: 255 }).notNull(),
});

export const prefixes = mysqlTable(
    "prefixes",
    {
        id: int("id").autoincrement().primaryKey().notNull(),
        serverId: varchar("server_id", { length: 50 }).notNull(),
        prefix: varchar("prefix", { length: 255 }).notNull(),
    },
    (table) => {
        return {
            serverId: uniqueIndex("server_id").on(table.serverId),
        };
    }
);

export const statuses = mysqlTable(
    "statuses",
    {
        id: int("id").autoincrement().notNull(),
        type: varchar("type", {
            length: 20,
            enum: ["PLAYING", "WATCHING", "STREAMING", "LISTENING", "COMPETING"],
        }).notNull(),
        status: varchar("status", { length: 255 }).notNull(),
    },
    (table) => {
        return {
            id: index("id").on(table.id),
            statusesTypeStatus: primaryKey(table.type, table.status),
        };
    }
);

export const redditPosts = mysqlTable(
    "reddit_posts",
    {
        id: int("id").autoincrement().primaryKey().notNull(),
        subreddit: varchar("subreddit", { length: 255 }).notNull(),
        title: text("title").notNull(),
        url: text("url").notNull(),
        over_18: boolean("over_18").notNull(),
        permalink: text("permalink").notNull(),
    },
    (table) => {
        return {
            subreddit: index("subreddit").on(table.subreddit),
        };
    }
);
