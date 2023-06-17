import "dotenv/config";
import { Config } from "drizzle-kit";

export default {
    schema: "./src/db/models/*.ts",
    breakpoints: true,
    connectionString: process.env.PLANETSCALE_URL,
} satisfies Config;
