import { defineConfig } from "drizzle-kit";

// export default {
//     schema: "./src/db/schema.ts",
//     breakpoints: true,
//     dialect: "sqlite",
//     driver: "turso",
//     dbCredentials: {
//         url: process.env.TURSO_DATABASE_URL,
//         authToken: process.env.TURSO_AUTH_TOKEN,
//     },
//     out: "./src/db/migrations",
// } satisfies Config;

export default defineConfig({
    schema: "./src/db/schema.ts",
    breakpoints: true,
    dialect: "turso",
    dbCredentials: {
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
    },
    out: "./src/db/migrations",
});
