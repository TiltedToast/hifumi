import { randomElementArray, randomIntFromRange } from "./tools.js";
import type { CatFactResponse } from "./interfaces/CatFactResponse";
import type { StatusDoc } from "./interfaces/StatusDoc";
import type { TextChannel, Client } from "discord.js";
import { statusArr } from "./app.js";
import fetch from "node-fetch";

export async function startCatFactLoop(channel: TextChannel): Promise<void> {
    setInterval(async () => {
        const response = await fetch("https://catfact.ninja/fact");
        const json = (await response.json()) as CatFactResponse;
        await channel.send(json.fact);
    }, randomIntFromRange(54000000, 86400000)); // 15h-24h
}

/**
 * Starts a loop which periodically changes the status to a random entry in the database
 * @param {Client} client Discord client which is used to access the API
 */
export async function startStatusLoop(client: Client) {
    setInterval(async () => {
        if (!client.user) return console.log("Could not set status, client user is undefined");
        const randomStatusDoc = randomElementArray(statusArr) as StatusDoc;
        const randomType = randomStatusDoc.type;
        const randomStatus = randomStatusDoc.status;

        client.user.setActivity(randomStatus, { type: randomType });
    }, randomIntFromRange(300000, 900000)); // 5m-15m
}
