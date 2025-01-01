import { z } from "zod";
import { fromZodError } from "zod-validation-error";

export const BOT_OWNERS = {
    primary: "258993932262834188",
    secondary: ["207505077013839883", "91598353833410560"],
} as const;
export const OWNER_NAME = "@toast.dll";
export const BOT_NAME = "Hifumi";
export const DEFAULT_PREFIX = "h!";
export const DEV_PREFIX = "h?";
export const RELOAD_PREFIX = "hr"; // this should always be lowercase
export const EMBED_COLOUR = "#CE3A9B";
export const DEV_CHANNELS = [
    "655484859405303809",
    "551588329003548683",
    "922679249058553857",
] as const;
export const LOG_CHANNEL = "655484804405657642";
export const CAT_FACT_CHANNEL = "655484859405303809";
export const REDDIT_USER_AGENT = `linux:${BOT_NAME}:v1.0.0 (by /u/tilted_toast)`;
export const IMAGE_THREAD_CHANNELS = [
    "1059119862741471253",
    "1059120608593584258",
    "1164282153396351097",
    "1164282173403185262",
] as const;
export const USER_AGENT = `${BOT_NAME}:v1.0.0:tiltedtoast27@gmail.com`;

// biome-ignore format: this is nicer
const envVariables = z.object({
    BOT_TOKEN:            z.string().min(1, "You must provide a Discord Bot Token"),
    BOT_ID:               z.string().min(1, "You must provide a Discord Bot ID"),
    EXCHANGE_API_KEY:     z.string().min(1, "You must provide an API key for currency conversion"),
    IMGUR_CLIENT_ID:      z.string().min(1, "You must provide an Imgur Client Id"),
    IMGUR_CLIENT_SECRET:  z.string().min(1, "You must provide an Imgur Client Secret"),
    REDDIT_CLIENT_ID:     z.string().min(1, "You must provide a Reddit Client Id"),
    REDDIT_CLIENT_SECRET: z.string().min(1, "You must provide a Reddit Client Secret"),
    REDDIT_REFRESH_TOKEN: z.string().min(1, "You must provide a Reddit Refresh Token"),
    TURSO_DATABASE_URL:   z.string().min(1, "You must provide a Turso Database URL"),
    TURSO_AUTH_TOKEN:     z.string().min(1, "You must provide a Turso Auth Token"),
    WOLFRAM_ALPHA_APP_ID: z.string().min(1, "You must provide a Wolfram|Alpha App ID"),
    DEV_MODE:             z.enum(["true", "false"]),
});

if (!process.argv.some((arg) => arg.includes("deploy-commands"))) {
    // This is a hacky way to check if we're imported by deploy-commands.ts
    // If we are, we don't want to parse the environment variables
    // Cause this crashes Github Actions and I don't want to deal with it
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

    if (Bun.which("gifsicle") === null) {
        console.error(
            "gifsicle is not installed, please install it and try again"
        );
        process.exit(1);
    }

    const magickCommand = process.platform === "win32" ? "magick" : "convert";

    if (Bun.which(magickCommand) === null) {
        console.error(
            "ImageMagick is not installed, please install it and try again"
        );
        process.exit(1);
    }
}

declare global {
    // biome-ignore lint/style/noNamespace: This has been validated above so it's fine
    namespace NodeJS {
        interface ProcessEnv extends z.infer<typeof envVariables> {}
    }
}
