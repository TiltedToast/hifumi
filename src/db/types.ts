import { InferModel } from "drizzle-orm";
import * as schema from "./schema.js";

export type Currency = InferModel<typeof schema.currencies>;
export type ErrorLog = InferModel<typeof schema.errorLogs>;
export type HelpMessage = InferModel<typeof schema.helpMessages>;
export type LeetChar = InferModel<typeof schema.leet>;
export type MikuCommandAlias = InferModel<typeof schema.mikuCommandAliases>;
export type MikuReaction = InferModel<typeof schema.mikuReactions>;
export type Prefix = InferModel<typeof schema.prefixes>;
export type Status = InferModel<typeof schema.statuses>;
export type NewStatus = InferModel<typeof schema.statuses, "insert">;
export type RedditPost = InferModel<typeof schema.redditPosts>;
export type NewRedditPost = InferModel<typeof schema.redditPosts, "insert">;
