import { mongoClient } from "./app.js";
import { botOwner } from "./main.js";


export async function insert(message) {
    if (!message.author.id === botOwner) {
        return;
    }

    const content = message.content.split(" ");
    if (!content.length >= 6) return message.channel.send("Invalid syntax!");

    const dbName = content[2];
    const collectionName = content[3];

    let document = {};

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


export async function update(message) {
    if (!message.author.id === botOwner) {
        return;
    }

    const content = message.content.split(" ");

    if (!content.length >= 8) return message.channel.send("Invalid syntax!");

    const dbName = content[2];
    const collectionName = content[3];

    const filterDoc = { [content[4]]: content[5] }

    let updateDoc = {};

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


export async function insertStatus(message) {
    if (!message.author.id === botOwner) {
        return;
    }
    const content = message.content.split(" ");

    if (!content.length === 3) return message.channel.send("Invalid syntax!");
    
    const status = content.slice(2).join(" ");

    const document = {
        type: content[1].toUpperCase(),
        status: status
    };

    const collection = mongoClient.db("hifumi").collection("statuses");
    await collection.insertOne(document);

    await message.channel.send("Status added!");
    await message.channel.send(JSON.stringify(document));
}