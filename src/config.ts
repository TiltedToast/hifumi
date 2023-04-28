/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable @typescript-eslint/no-namespace */
import { z } from "zod";

export const BOT_OWNERS = ["258993932262834188", "207505077013839883"];
export const EMBED_COLOUR = "#CE3A9B";
export const DEV_CHANNELS = ["655484859405303809", "551588329003548683", "922679249058553857"];
export const LOG_CHANNEL = "655484804405657642";
export const CAT_FACT_CHANNEL = "655484859405303809";

const envVariables = z.object({
    BOT_TOKEN: z.string(),
    EXCHANGE_API_KEY: z.string(),
    IMGUR_CLIENT_ID: z.string(),
    IMGUR_CLIENT_SECRET: z.string(),
    REDDIT_CLIENT_ID: z.string(),
    REDDIT_CLIENT_SECRET: z.string(),
    REDDIT_REFRESH_TOKEN: z.string(),
    PLANETSCALE_URL: z.string(),
    WOLFRAM_ALPHA_APP_ID: z.string(),
    DEV_MODE: z.union([z.literal("true"), z.literal("false")]),
});

envVariables.parse(process.env);

declare global {
    namespace NodeJS {
        interface ProcessEnv extends z.infer<typeof envVariables> {}
    }
}
