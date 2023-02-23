import type { Client, TextChannel } from "discord.js";
import fetch from "node-fetch";
import { statusArr } from "../app.js";
import { CatFactResponse, CatFactResponseSchema, StatusDoc, StatusType } from "../helpers/types.js";
import { randomElementFromArray, randomIntFromRange, sleep } from "../helpers/utils.js";

export async function startCatFactLoop(channel: TextChannel) {
    while (true) {
        const response = await fetch("https://catfact.ninja/fact");
        const json = (await response.json()) as CatFactResponse;

        if (!CatFactResponseSchema.safeParse(json).success) {
            console.error("Error parsing cat fact response");
            continue;
        }

        await channel.send(json.fact);
        await sleep(randomIntFromRange(54000000, 86400000)); // 15h-24h
    }
}

/**
 * Starts a loop which periodically changes the status to a random entry in the database
 * @param {Client} client Discord client which is used to access the API
 */
export async function startStatusLoop(client: Client) {
    while (true) {
        const status = await setRandomStatus(client);
        if (!status) break;
        await sleep(randomIntFromRange(300000, 900000)); // 5m-15m
    }
}

/**
 * Grabs a random status from the database and sets it as the status of the bot
 * @param client Discord client used to access the API
 */
async function setRandomStatus(client: Client) {
    if (!client.user) return console.error("Could not set status, client user is undefined");
    const randomStatusDoc = randomElementFromArray(statusArr) as StatusDoc;
    const { type, status } = randomStatusDoc;

    return client.user.setActivity(status, { type: StatusType[type] });
}
