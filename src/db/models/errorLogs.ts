import { int, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

const errorLogs = mysqlTable("error_logs", {
    id: int("id").autoincrement().primaryKey(),
    server: varchar("server", { length: 255 }),
    channel: varchar("channel", { length: 255 }).notNull(),
    user: varchar("user", { length: 255 }).notNull(),
    command: text("command"),
    stack: text("stack"),
    timestamp: timestamp("timestamp", { mode: "string" }).defaultNow(),
    log: text("log"),
    error: text("error"),
});

export default errorLogs;
