/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type { Client, TextChannel } from "discord.js";
import { statusArr } from "../app.js";
import { db } from "../db/index.js";
import { errorLogs } from "../db/schema.js";
import { CatFactResponse, CatFactResponseSchema, StatusType } from "../helpers/types.js";
import {
    isDev,
    randomElementFromArray,
    randomIntFromRange,
    sleep as utilSleep,
} from "../helpers/utils.js";

export async function startCatFactLoop(channel: TextChannel) {
    const sleep = async () => await utilSleep(randomIntFromRange(54000000, 86400000)); // 15h-24h

    while (true) {
        const response = await fetch("https://catfact.ninja/fact").catch(console.error);

        if (!response) {
            await channel.send("Error fetching cat fact");
            await sleep();
            continue;
        }

        const json = (await response.json().catch(console.error)) as CatFactResponse;

        if (!json || !CatFactResponseSchema.safeParse(json).success) {
            await channel.send("Error parsing cat fact response");
            await sleep();
            continue;
        }

        await channel.send(json.fact);
        await sleep();
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
        await utilSleep(randomIntFromRange(300000, 900000)); // 5m-15m
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

export async function avoidDbSleeping() {
    const sixDaysinSeconds = 518400;

    if (isDev()) return;

    while (true) {
        await db.insert(errorLogs).values({
            channel: "N/A",
            error: "Avoiding database freezing",
            user: "N/A",
        });

        await utilSleep(sixDaysinSeconds * 1000);
    }
}
