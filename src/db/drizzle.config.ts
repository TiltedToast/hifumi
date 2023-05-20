import "dotenv/config";
import { Config } from "drizzle-kit";

export default {
    schema: "./src/db/models/*.ts",
    connectionString: process.env.PLANETSCALE_URL,
    breakpoints: true,
} satisfies Config;
