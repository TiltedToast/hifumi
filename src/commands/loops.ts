import fetch from "node-fetch";
import { statusArr } from "../app.js";
import { randomElementArray, randomIntFromRange } from "./tools.js";
import { StatusDoc, StatusType } from "../interfaces/StatusDoc.js";
import type { CatFactResponse } from "../interfaces/CatFactResponse.js";
import type { TextChannel, Client } from "discord.js";

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
    await setRandomStatus(client);
    setInterval(async () => {
        await setRandomStatus(client);
    }, randomIntFromRange(300000, 900000)); // 5m-15m
}

/**
 * Grabs a random status from the database and sets it as the status of the bot
 * @param client Discord client used to access the API
 */
async function setRandomStatus(client: Client) {
    if (!client.user) return console.log("Could not set status, client user is undefined");
    const randomStatusDoc = randomElementArray(statusArr) as StatusDoc;
    const { type, status } = randomStatusDoc;

    return client.user.setActivity(status, { type: StatusType[type] });
}
