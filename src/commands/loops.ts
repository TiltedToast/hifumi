/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type { Client, TextChannel } from "discord.js";
import fetch from "node-fetch";
import { statusArr } from "../app.js";
import { db } from "../db/index.js";
import errorLogs from "../db/models/errorLogs.js";
import { CatFactResponse, CatFactResponseSchema, StatusType } from "../helpers/types.js";
import { isDev, randomElementFromArray, randomIntFromRange, sleep } from "../helpers/utils.js";

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

    return client.user.setActivity(randStatus.status, {
        type: StatusType[randStatus.type],
    });
}

export async function avoidDbSleeping() {
    const sixDaysinSeconds = 518400;

    if (isDev()) return;

    while (true) {
        await db.insert(errorLogs).values({
            channel: "N/A",
            error: "Avoiding database freezing",
            user: "N/A",
        });

        await sleep(sixDaysinSeconds * 1000);
    }
}
