import * as tools from "./tools.js";
import * as main from "./main.js";
import { credentials } from "./config.js";
import { Client, Intents } from "discord.js";
import { MongoClient, ObjectId } from "mongodb";
import clearModule from "clear-module";
import { botOwner } from "./main.js";


const allIntents = new Intents(32767);
export const client = new Client({ intents: allIntents });
export const mongoClient = new MongoClient(credentials["mongoURI"]);
const startTime = Date.now();

client.once("ready", async () => {
    const time = tools.strftime("%d/%m/%Y %H:%M:%S");
    const doneLoadingTime = Date.now();

    console.log(
        `Started up in ${(doneLoadingTime - startTime) /
        1000} seconds on ${time}`
    );
    console.log("Logged in as:");
    console.log(client.user.username);
    console.log(client.user.id);
    console.log("------");

    await mongoClient.connect();
    console.log("Connected to the database");

    const collection = mongoClient.db("hifumi").collection("statuses");
    const randomDoc = await collection.aggregate([{ $sample: { size: 1 } }]).toArray();
    const randomStatus = randomDoc[0].status;
    const randomType = randomDoc[0].type;

    client.user.setActivity(randomStatus, { type: randomType });
    await tools.setRandomStatus(client);

    // const channel = client.channels.cache.get('655484804405657642');
    // channel.send(`Logged in as:\n${client.user.username}\nTime: ${time}\n--------------------------`);
});


client.on("messageCreate", async (message) => {
    let msg;
    if (message.content.startsWith("hr~")) {
        if (message.author.id === botOwner) {
            try {
                // await main.restartBot(message);
                msg = "Reload successful!"
            } catch (e) {
                msg = `Reload failed!\n${e}`;
            }
            console.log(msg);
            await message.channel.send(msg);
        } else {
            await message.channel.send("Insufficient Permissions!")
        }
    } else {
        await main.messageIn(message);
    }
});


client.login(credentials["token"]);
