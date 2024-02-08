import type { Status } from "../db/types.ts";
import { db } from "../db/index.ts";
import { statuses } from "../db/schema.ts";
import type { Client } from "discord.js";
import { StatusType } from "../helpers/types.ts";
import { randomIntFromRange, randomElementFromArray, sleep } from "../helpers/utils.ts";

export let statusArr: Status[] = [];

export async function init() {
    statusArr = await db.select().from(statuses);
}

/**
 * Starts a loop which periodically changes the status to a random entry in the database
 * @param {Client} client Discord client which is used to access the API
 */
export async function startStatusLoop(client: Client) {
    if (statusArr.length === 0) return;
    while (true) {
        const status = setRandomStatus(client);
        if (!status) break;
        await sleep(randomIntFromRange(300000, 900000)); // 5m-15m
    }
}

/**
 * Grabs a random status from the database and sets it as the status of the bot
 * @param client Discord client used to access the API
 */
function setRandomStatus(client: Client) {
    if (!client.user) return console.error("Could not set status, client user is undefined");
    const randStatus = randomElementFromArray(statusArr);

    return client.user.setActivity({
        name: randStatus.type !== "CUSTOM" ? randStatus.status : "Custom status",
        state: randStatus.type === "CUSTOM" ? randStatus.status : undefined,
        type: StatusType[randStatus.type],
    });
}
