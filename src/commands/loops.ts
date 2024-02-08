import type { TextChannel } from "discord.js";
import { db } from "../db/index.ts";
import { errorLogs } from "../db/schema.ts";
import { CatFactResponseSchema, type CatFactResponse } from "../helpers/types.ts";
import { isDev, randomIntFromRange, sleep as utilSleep } from "../helpers/utils.ts";

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

        if (!(json && CatFactResponseSchema.safeParse(json).success)) {
            await channel.send("Error parsing cat fact response");
            await sleep();
            continue;
        }

        await channel.send(json.fact);
        await sleep();
    }
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
