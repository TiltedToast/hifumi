import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import * as schema from "./schema.ts";

export type ErrorLog = InferSelectModel<typeof schema.errorLogs>;
export type HelpMessage = InferSelectModel<typeof schema.helpMessages>;
export type LeetChar = InferSelectModel<typeof schema.leet>;
export type AiCommandAlias = InferSelectModel<typeof schema.aiCommandAliases>;
export type AiReaction = InferSelectModel<typeof schema.aiReactions>;
export type Prefix = InferSelectModel<typeof schema.prefixes>;

export type Status = InferSelectModel<typeof schema.statuses>;
export type NewStatus = InferInsertModel<typeof schema.statuses>;
export type RedditPost = InferSelectModel<typeof schema.redditPosts>;
export type NewRedditPost = InferInsertModel<typeof schema.redditPosts>;

export const InsertRedditPostSchema = createInsertSchema(schema.redditPosts);
export const SelectRedditPostSchema = createSelectSchema(schema.redditPosts);
export const InsertStatusSchema = createInsertSchema(schema.statuses);
export const SelectStatusSchema = createSelectSchema(schema.statuses);
