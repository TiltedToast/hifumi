/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable @typescript-eslint/no-namespace */
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

// First one is the one that gets pinged in the event of an error
export const BOT_OWNERS = ["258993932262834188", "207505077013839883"];
export const OWNER_NAME = "@toast.dll";
export const BOT_NAME = "Hifumi";
export const DEFAULT_PREFIX = "h!";
export const DEV_PREFIX = "h?";
export const RELOAD_PREFIX = "hr"; // this should always be lowercase
export const EMBED_COLOUR = "#CE3A9B";
export const DEV_CHANNELS = ["655484859405303809", "551588329003548683", "922679249058553857"];
export const LOG_CHANNEL = "655484804405657642";
export const CAT_FACT_CHANNEL = "655484859405303809";

// prettier-ignore
const envVariables = z.object({
    BOT_TOKEN:            z.string().nonempty("You must provide a Discord Bot Token"),
    EXCHANGE_API_KEY:     z.string().nonempty("You must provide an API key for currency conversion"),
    IMGUR_CLIENT_ID:      z.string().nonempty("You must provide an Imgur Client Id"),
    IMGUR_CLIENT_SECRET:  z.string().nonempty("You must provide an Imgur Client Secret"),
    REDDIT_CLIENT_ID:     z.string().nonempty("You must provide a Reddit Client Id"),
    REDDIT_CLIENT_SECRET: z.string().nonempty("You must provide a Reddit Client Secret"),
    REDDIT_REFRESH_TOKEN: z.string().nonempty("You must provide a Reddit Refresh Token"),
    PLANETSCALE_URL:      z.string().nonempty("You must provide a PlanetScale Database URL"),
    WOLFRAM_ALPHA_APP_ID: z.string().nonempty("You must provide a Wolfram|Alpha App ID"),
    DEV_MODE:             z.enum(["true", "false"]),
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
