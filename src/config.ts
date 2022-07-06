export const BOT_TOKEN = process.env["BOT_TOKEN"] ?? "";
export const EXCHANGE_API_KEY = process.env["EXCHANGE_API_KEY"] ?? "";
export const IMGUR_CLIENT_ID = process.env["IMGUR_CLIENT_ID"] ?? "";
export const IMGUR_CLIENT_SECRET = process.env["IMGUR_CLIENT_SECRET"] ?? "";
export const REDDIT_CLIENT_ID = process.env["REDDIT_CLIENT_ID"] ?? "";
export const REDDIT_CLIENT_SECRET = process.env["REDDIT_CLIENT_SECRET"] ?? "";
export const REDDIT_REFRESH_TOKEN = process.env["REDDIT_REFRESH_TOKEN"] ?? "";
export const MONGO_URI =
    process.env["npm_lifecycle_event"] === "docker-build"
        ? "mongodb://db:27017/"
        : process.env["MONGO_URI"] ?? "mongodb://localhost:27017/";
export const DEV_MODE = process.env["DEV_MODE"] ?? "false";
export const BOT_OWNERS = ["258993932262834188", "207505077013839883"];
export const EMBED_COLOUR = "#ce3a9b";
export const DEV_CHANNELS = ["655484859405303809", "551588329003548683", "922679249058553857"];
export const LOG_CHANNEL = "655484804405657642";
export const CAT_FACT_CHANNEL = "655484859405303809";
