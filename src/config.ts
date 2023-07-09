/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable @typescript-eslint/no-namespace */
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

export const BOT_OWNERS = ["258993932262834188", "207505077013839883"];
export const OWNER_USERNAME = "@toast.dll";
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
    DEV_MODE: z.enum(["true", "false"]),
});

envVariables.parseAsync(process.env).catch((e) => {
    const validationError = fromZodError(e as z.ZodError, {
        issueSeparator: "\n",
        prefix: "",
        prefixSeparator: "",
        unionSeparator: "\n",
    });
    console.error("\nError validating environment variables:\n");
    console.error(validationError.message);
    process.exit(1);
});

declare global {
    namespace NodeJS {
        interface ProcessEnv extends z.infer<typeof envVariables> {}
    }
}
