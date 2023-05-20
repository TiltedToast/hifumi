import { Config } from "drizzle-kit";
import "dotenv/config";

export default {
    schema: "./src/db/schema.ts",
    connectionString: process.env.PLANETSCALE_URL,
    breakpoints: true,
} satisfies Config;
