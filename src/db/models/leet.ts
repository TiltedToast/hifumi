import { char, int, mysqlTable, varchar } from "drizzle-orm/mysql-core";

const leet = mysqlTable("leet", {
    id: int("id").autoincrement().primaryKey(),
    source: char("source", { length: 1 }).notNull(),
    translated: varchar("translated", { length: 10 }).notNull(),
});

export default leet;
