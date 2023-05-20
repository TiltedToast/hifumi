import { int, mysqlTable, varchar } from "drizzle-orm/mysql-core";

const helpMessages = mysqlTable("help_messages", {
    id: int("id").autoincrement().primaryKey(),
    cmd: varchar("cmd", { length: 100 }).notNull(),
    desc: varchar("desc", { length: 255 }).notNull(),
});

export default helpMessages;
