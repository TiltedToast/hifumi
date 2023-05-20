import { int, mysqlTable, varchar } from "drizzle-orm/mysql-core";

export const mikuCommandAliases = mysqlTable("miku_command_aliases", {
    id: int("id").autoincrement().primaryKey(),
    command: varchar("command", { length: 255 }).notNull(),
    alias: varchar("alias", { length: 255 }).notNull(),
});

export const mikuReactions = mysqlTable("miku_reactions", {
    id: int("id").autoincrement().primaryKey(),
    command: varchar("command", { length: 255 }).notNull(),
    reaction: varchar("reaction", { length: 255 }).notNull(),
});
