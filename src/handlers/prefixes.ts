import type { Snowflake } from "discord.js";
import { DEFAULT_PREFIX, DEV_PREFIX } from "../config.ts";
import { db } from "../db/index.ts";
import { prefixes } from "../db/schema.ts";
import { isDev } from "../helpers/utils.ts";
import type { NarrowedMessage } from "../helpers/types.ts";

export const prefixMap = new Map<Snowflake, string>();
let botIsLoading = true;

export function isLoading() {
    return botIsLoading;
}

export function loadingDone() {
    botIsLoading = false;
}

export async function init() {
    for (const prefixDoc of await db.select().from(prefixes)) {
        prefixMap.set(prefixDoc.serverId, prefixDoc.prefix);
    }
}
