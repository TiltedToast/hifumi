import { mongoClient, botOwner, prefixDict, statusArr } from "./app.js";
import { Message, Permissions } from 'discord.js';
import * as tools from './tools.js';


export async function insert(message: Message) {
    if (!(message.author.id === botOwner)) return;

    const content = message.content.split(" ");
    if (!(content.length >= 6) && (content.length % 2 !== 0)) return await message.channel.send("Invalid syntax!");

    const dbName = content[2];
    const collectionName = content[3];

    const document = await tools.parseDbArgs(4, message)


    const collection = mongoClient.db(dbName).collection(collectionName);
    await collection.insertOne(document);

    await message.channel.send(`Inserted document into ${dbName}.${collectionName}`);
    await message.channel.send(JSON.stringify(document));

}


export async function update(message: Message) {
    if (!(message.author.id === botOwner)) return;

    const content = message.content.split(" ");

    if (!(content.length >= 8) && (content.length % 2 !== 0)) return await message.channel.send("Invalid syntax!");

    const dbName = content[2];
    const collectionName = content[3];

    const filterDoc = { [content[4]]: content[5] }

    const updateDoc = await tools.parseDbArgs(6, message);


    const collection = mongoClient.db(dbName).collection(collectionName);
    await collection.updateOne(filterDoc, { $set: updateDoc });

    await message.channel.send(`Updated document in ${dbName}.${collectionName}`);

    const updatedDoc = collection.findOne(updateDoc);
    await message.channel.send(JSON.stringify(updatedDoc));
}


export async function insertStatus(message: Message) {
    if (!(message.author.id === botOwner)) return;

    const content = message.content.split(" ");

    if (!(content.length >= 3)) return await message.channel.send("Invalid syntax!");

    const status = content.slice(2).join(" ");
    const type = content[1].toUpperCase()

    // Uppercases the type to conform to discord's API 
    const document = {
        type: type,
        status: status
    };

    const collection = mongoClient.db("hifumi").collection("statuses");
    await collection.insertOne(document);
    statusArr.push(document);

    await message.channel.send("Status added!");
    await message.channel.send(JSON.stringify(document));
}


export async function updatePrefix(message: Message) {
    // Permission check for Kick Permissions or being the Bot Owner
    if (!message.member?.permissions.has(Permissions.FLAGS.KICK_MEMBERS) && !(message.author.id === botOwner)) {
        return message.channel.send("Insuficient permissions!");
    }

    const content = message.content.split(" ");
    const collection = mongoClient.db("hifumi").collection("prefixes");

    // Syntax check as well as avoiding cluttering the database with long impractical prefixes
    if (!(content.length === 2)) return await message.channel.send("Invalid syntax!");
    if (content[1].length > 5) return await message.channel.send("Prefix too long!");

    // Finds the guild's document in the database
    // Updates said docment with the new prefix
    if (message.guild === null) return;

    const serverId = message.guild.id;
    const filterDoc = { serverId: serverId };
    const updateDoc = { $set: { prefix: content[1] } };
    await collection.updateOne(filterDoc, updateDoc);
    prefixDict[serverId] = content[1];
    await message.channel.send(`Updated prefix for this server to \`${content[1]}\`!`);

}