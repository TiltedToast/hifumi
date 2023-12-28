import "dotenv/config";
import { type Config } from "drizzle-kit";

export default {
    schema: "./src/db/schema.ts",
    breakpoints: true,
    driver: "mysql2",
    dbCredentials: {
        uri: process.env.PLANETSCALE_URL,
    },
} satisfies Config;
