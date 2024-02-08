import type { Snowflake } from "discord.js";
import { db } from "../db/index.ts";
import { prefixes } from "../db/schema.ts";

export const prefixMap = new Map<Snowflake, string>();
export let botIsLoading = false;

export function setLoading() {
    botIsLoading = true;
}

export async function init() {
    for (const prefixDoc of await db.select().from(prefixes)) {
        prefixMap.set(prefixDoc.serverId, prefixDoc.prefix);
    }
}
