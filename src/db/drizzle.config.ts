import "dotenv/config";
import { Config } from "drizzle-kit";

export default {
    schema: "./src/db/schema.ts",
    breakpoints: true,
    driver: "mysql2",
    dbCredentials: {
        connectionString: process.env.PLANETSCALE_URL,
    },
} satisfies Config;
