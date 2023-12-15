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
} from "drizzle-orm/mysql-core";

export const errorLogs = mysqlTable(
    "error_logs",
    {
        id: int("id").autoincrement(),
        server: varchar("server", { length: 255 }),
        channel: varchar("channel", { length: 255 }).notNull(),
        user: varchar("user", { length: 255 }).notNull(),
        command: text("command"),
        stack: text("stack"),
        timestamp: timestamp("timestamp", { mode: "string" }).defaultNow(),
        log: text("log"),
        error: text("error"),
    },
    (table) => {
        return {
            pk: primaryKey({
                columns: [table.id],
            }),
        };
    },
);

export const helpMessages = mysqlTable(
    "help_messages",
    {
        id: int("id").autoincrement(),
        cmd: varchar("cmd", { length: 100 }).notNull(),
        desc: varchar("desc", { length: 255 }).notNull(),
    },
    (table) => {
        return {
            pk: primaryKey({ columns: [table.id] }),
        };
    },
);

export const leet = mysqlTable(
    "leet",
    {
        id: int("id").autoincrement(),
        source: char("source", { length: 1 }).notNull(),
        translated: varchar("translated", { length: 10 }).notNull(),
    },
    (table) => {
        return {
            pk: primaryKey({ columns: [table.id] }),
        };
    },
);

export const mikuCommandAliases = mysqlTable(
    "miku_command_aliases",
    {
        id: int("id").autoincrement(),
        command: varchar("command", { length: 255 }).notNull(),
        alias: varchar("alias", { length: 255 }).notNull(),
    },
    (table) => {
        return {
            pk: primaryKey({ columns: [table.id] }),
        };
    },
);

export const mikuReactions = mysqlTable(
    "miku_reactions",
    {
        id: int("id").autoincrement(),
        command: varchar("command", { length: 255 }).notNull(),
        reaction: varchar("reaction", { length: 255 }).notNull(),
    },
    (table) => {
        return {
            pk: primaryKey({ columns: [table.id] }),
        };
    },
);

export const prefixes = mysqlTable(
    "prefixes",
    {
        id: int("id").autoincrement(),
        serverId: varchar("server_id", { length: 255 }).notNull(),
        prefix: varchar("prefix", { length: 255 }).notNull(),
    },
    (table) => {
        return {
            serverId: uniqueIndex("server_id").on(table.serverId),
            pk: primaryKey({ columns: [table.id] }),
        };
    },
);

export const redditPosts = mysqlTable(
    "reddit_posts",
    {
        id: int("id").autoincrement(),
        subreddit: varchar("subreddit", { length: 50 }).notNull(),
        title: varchar("title", { length: 255 }).notNull(),
        url: varchar("url", { length: 255 }).notNull(),
        over_18: boolean("over_18").notNull(),
        permalink: varchar("permalink", { length: 255 }).notNull(),
    },
    (table) => {
        return {
            subredditIdx: index("subreddit_idx").on(table.subreddit),
            pk: primaryKey({ columns: [table.id] }),
        };
    },
);

export const statuses = mysqlTable(
    "statuses",
    {
        id: int("id").autoincrement().notNull(),
        type: varchar("type", {
            length: 20,
            enum: ["PLAYING", "WATCHING", "STREAMING", "LISTENING", "COMPETING", "CUSTOM"],
        }).notNull(),
        status: varchar("status", { length: 128 }).notNull(),
    },
    (table) => {
        return {
            idIdx: index("id").on(table.id),
            uniqueStatus: primaryKey({
                columns: [table.type, table.status],
            }),
        };
    },
);
