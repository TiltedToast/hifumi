import { mongoClient, prefixDict, statusArr } from "../app.js";
import type { Message } from "discord.js";
import { isDev, parseDbArgs, hasPermission } from "./tools.js";
import { BOT_OWNERS } from "../config.js";
import { StatusType } from "../interfaces/StatusDoc.js";

export async function insert(message: Message): Promise<void | Message<boolean>> {
    if (!BOT_OWNERS.includes(message.author.id)) return;

    const content = message.content.split(" ");
    if (content.length < 6 || content.length % 2 !== 0) return await message.channel.send("Invalid syntax!");

    if (isDev()) await message.channel.send("Add your stuff to the cloud db instead <:emiliaSMH:747132102645907587>");

    const dbName = content[2];
    const collectionName = content[3];

    const document = parseDbArgs(4, content);

    const collection = mongoClient.db(dbName).collection(collectionName);
    await collection.insertOne(document);

    await message.channel.send(`Inserted document into ${dbName}.${collectionName}`);
    await message.channel.send(`\`\`\`json\n${JSON.stringify(document, null, 4)}\n\`\`\``);
}

export async function update(message: Message): Promise<void | Message<boolean>> {
    if (!BOT_OWNERS.includes(message.author.id)) return;

    const content = message.content.split(" ");

    if (content.length < 8 || content.length % 2 !== 0) return await message.channel.send("Invalid syntax!");

    if (isDev()) await message.channel.send("Update the cloud db instead <:emiliaSMH:747132102645907587>");

    const dbName = content[2];
    const collectionName = content[3];

    const filterDoc = { [content[4]]: content[5] };

    const newValues = parseDbArgs(6, content);

    const collection = mongoClient.db(dbName).collection(collectionName);
    const updateDoc = await collection.findOneAndUpdate(filterDoc, { $set: newValues });
    if (!updateDoc.value) return await message.channel.send("No document found!");

    if (!updateDoc.ok) return await message.channel.send("Couldn't update document");
    const updatedDoc = await collection.findOne(updateDoc.value._id);

    await message.channel.send(`Updated document in ${dbName}.${collectionName}`);
    await message.channel.send(`\`\`\`json\n${JSON.stringify(updatedDoc, null, 4)}\n\`\`\``);
}

export async function deleteDoc(message: Message) {
    if (!BOT_OWNERS.includes(message.author.id)) return;

    const content = message.content.split(" ");

    const document = parseDbArgs(4, content);

    const collection = mongoClient.db(content[2]).collection(content[3]);

    const deletedDoc = await collection.findOneAndDelete(document);
    if (!deletedDoc.value) return await message.channel.send("No document found!");

    await message.channel.send(`Successfully deleted document from ${content[2]}.${content[3]}`);
    return message.channel.send(`\`\`\`json\n${JSON.stringify(deletedDoc.value, null, 4)}\n\`\`\``);
}

export async function insertStatus(message: Message): Promise<void | Message<boolean>> {
    if (!BOT_OWNERS.includes(message.author.id)) return;

    const content = message.content.split(" ");

    if (content.length < 3) return await message.channel.send("Invalid syntax!");

    const status = content.slice(2).join(" ");
    const type = content[1].toUpperCase();

    if (!(type in StatusType)) return await message.channel.send("Invalid type!");

    if (isDev()) {
        await message.channel.send("Add your statuses to the cloud db instead <:emiliaSMH:747132102645907587>");
    }

    // Uppercases the type to conform to discord's API
    const document = { type, status };

    const collection = mongoClient.db("hifumi").collection("statuses");
    await collection.insertOne(document);
    statusArr.push(document);

    await message.channel.send("Status added!");
    await message.channel.send(`\`\`\`json\n${JSON.stringify(document, null, 4)}\n\`\`\``);
}

export async function updatePrefix(message: Message) {
    // Permission check for Kick Permissions or being the Bot Owner
    if (!hasPermission("KICK_MEMBERS", message) && !BOT_OWNERS.includes(message.author.id)) {
        return message.channel.send("Insufficient permissions!");
    }

    const content = message.content.split(" ");
    const collection = mongoClient.db("hifumi").collection("prefixes");

    // Syntax check as well as avoiding cluttering the database with long impractical prefixes
    if (content.length !== 2) return await message.channel.send("Invalid syntax!");
    if (content[1].length > 5) return await message.channel.send("Prefix too long!");

    if (isDev()) await message.channel.send("Wrong database <:emiliaSMH:747132102645907587>");

    // Finds the guild's document in the database
    // Updates said document with the new prefix
    if (message.guild === null) return await message.channel.send("This command can only be used in a server!");

    const serverId = message.guild.id;
    const filterDoc = { serverId: serverId };
    const updateDoc = { $set: { prefix: content[1] } };
    await collection.updateOne(filterDoc, updateDoc);
    prefixDict[serverId] = content[1];
    return await message.channel.send(`Updated prefix for this server to \`${content[1]}\`!`);
}
