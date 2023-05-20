import { int, mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

const prefixes = mysqlTable(
    "prefixes",
    {
        id: int("id").autoincrement().primaryKey(),
        serverId: varchar("server_id", { length: 255 }).notNull(),
        prefix: varchar("prefix", { length: 255 }).notNull(),
    },
    (table) => {
        return {
            serverId: uniqueIndex("server_id").on(table.serverId),
        };
    }
);

export default prefixes;
