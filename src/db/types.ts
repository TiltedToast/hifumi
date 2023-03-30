import { InferModel } from "drizzle-orm";
import {
    currencies,
    errorLogs,
    helpMessages,
    leet,
    mikuCommandAliases,
    mikuReactions,
    prefixes,
    redditPosts,
    statuses,
} from "./schema.js";

export type Currency = InferModel<typeof currencies>;
export type ErrorLog = InferModel<typeof errorLogs>;
export type HelpMessage = InferModel<typeof helpMessages>;
export type LeetChar = InferModel<typeof leet>;
export type MikuCommandAlias = InferModel<typeof mikuCommandAliases>;
export type MikuReaction = InferModel<typeof mikuReactions>;
export type Prefix = InferModel<typeof prefixes>;
export type Status = InferModel<typeof statuses>;
export type NewStatus = InferModel<typeof statuses, "insert">;
export type RedditPost = InferModel<typeof redditPosts>;
export type NewRedditPost = InferModel<typeof redditPosts, "insert">;
