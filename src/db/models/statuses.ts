import { index, int, mysqlTable, primaryKey, varchar } from "drizzle-orm/mysql-core";

const statuses = mysqlTable(
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
            idIdx: index("id").on(table.id),
            uniqueStatus: primaryKey(table.type, table.status),
        };
    }
);

export default statuses;
