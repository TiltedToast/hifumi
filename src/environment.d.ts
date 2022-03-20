declare global {
    namespace NodeJS {
        interface ProcessEnv {
            BOT_TOKEN: string;
            EXCHANGE_API_KEY: string;
            IMGUR_CLIENT_ID: string;
            IMGUR_CLIENT_SECRET: string;
            REDDIT_CLIENT_ID: string;
            REDDIT_CLIENT_SECRET: string;
            REDDIT_REFRESH_TOKEN: string;
            MONGO_URI: string;
            DEV_MODE: string;
        }
    }
}

export {};
