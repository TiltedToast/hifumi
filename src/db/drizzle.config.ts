import { type Config } from "drizzle-kit";

export default {
    schema: "./src/db/schema.ts",
    breakpoints: true,
    driver: "turso",
    dbCredentials: {
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
    },
    out: "./src/db/migrations",
} satisfies Config;
