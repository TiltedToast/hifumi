import { InferModel } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import * as schema from "./schema.js";

export type ErrorLog = InferModel<typeof schema.errorLogs>;
export type HelpMessage = InferModel<typeof schema.helpMessages>;
export type LeetChar = InferModel<typeof schema.leet>;
export type MikuCommandAlias = InferModel<typeof schema.mikuCommandAliases>;
export type MikuReaction = InferModel<typeof schema.mikuReactions>;
export type Prefix = InferModel<typeof schema.prefixes>;

export type Status = z.infer<typeof SelectStatusSchema>;
export type NewStatus = z.infer<typeof InsertStatusSchema>;
export type RedditPost = z.infer<typeof SelectRedditPostSchema>;
export type NewRedditPost = z.infer<typeof InsertRedditPostSchema>;

export const InsertRedditPostSchema = createInsertSchema(schema.redditPosts);
export const SelectRedditPostSchema = createSelectSchema(schema.redditPosts);
export const InsertStatusSchema = createInsertSchema(schema.statuses);
export const SelectStatusSchema = createSelectSchema(schema.statuses);
