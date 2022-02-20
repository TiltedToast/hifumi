import { mongoClient } from "./app.js";
import { botOwner } from "./app.js";
import { Message, Permissions } from 'discord.js';


export async function insert(message: Message) {
    if (!(message.author.id === botOwner)) return;

    const content = message.content.split(" ");
    if (!(content.length >= 6) && (content.length % 2 !== 0)) return await message.channel.send("Invalid syntax!");

    const dbName = content[2];
    const collectionName = content[3];

    let document = {};

    // Loops over the argument pairs and adds them to as key value pairs in the document
    for (let i = 4; i < content.length; i++) {
        if (i % 2 === 0) {
            if (content[i + 1].includes("_")) {
                document[content[i]] = content[i + 1].replace(/_/g, " ");
            } else {
                document[content[i]] = content[i + 1];
            }
        } else {
            continue;
        }
    }


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

    let updateDoc = {};

    // Loops over the argument pairs and adds them to as key value pairs in the document
    for (let i = 6; i < content.length; i++) {
        if (i % 2 === 0) {
            if (content[i + 1].includes("_")) {
                updateDoc[content[i]] = content[i + 1].replace(/_/g, " ");
            } else {
                updateDoc[content[i]] = content[i + 1];
            }
        } else {
            continue;
        }
    }


    const collection = mongoClient.db(dbName).collection(collectionName);
    await collection.updateOne(filterDoc, { $set: updateDoc });

    await message.channel.send(`Updated document in ${dbName}.${collectionName}`);

    const updatedDoc = await collection.findOne(updateDoc);
    await message.channel.send(JSON.stringify(updatedDoc));
}


export async function insertStatus(message: Message) {
    if (!(message.author.id === botOwner)) return;

    const content = message.content.split(" ");

    if (!(content.length >= 3)) return await message.channel.send("Invalid syntax!");

    const status = content.slice(2).join(" ");

    // Uppercases the type to conform to discord's API 
    const document = {
        type: content[1].toUpperCase(),
        status: status
    };

    const collection = mongoClient.db("hifumi").collection("statuses");
    await collection.insertOne(document);

    await message.channel.send("Status added!");
    await message.channel.send(JSON.stringify(document));
}


export async function updatePrefix(message: Message) {
    // Permission check for Kick Permissions or being the Bot Owner
    if (!message.member.permissions.has(Permissions.FLAGS.KICK_MEMBERS) && !(message.author.id === botOwner)) {
        return message.channel.send("Insuficient permissions!");
    }

    const content = message.content.split(" ");
    const collection = mongoClient.db("hifumi").collection("prefixes");

    // Syntax check as well as avoiding cluttering the database with long impractical prefixes
    if (!(content.length === 2)) return await message.channel.send("Invalid syntax!");
    if (content[1].length > 5) return await message.channel.send("Prefix too long!");

    // Finds the guild's document in the database
    // Updates said docment with the new prefix
    const serverId = message.guild.id;
    const filterDoc = { serverId: serverId };
    const updateDoc = { $set: { prefix: content[1] } };
    await collection.updateOne(filterDoc, updateDoc);
    await message.channel.send(`Updated prefix for this server to \`${content[1]}\`!`);

}