import { Message, PermissionFlagsBits } from "discord.js";
import { PSConnection, db, prefixMap, statusArr } from "../app.js";
import { BOT_OWNERS } from "../config.js";
import { prefixes, statuses } from "../db/schema.js";
import { Status } from "../db/types.js";
import { StatusType } from "../helpers/types.js";
import { hasPermission, isBotOwner, isDev } from "../helpers/utils.js";
import { eq } from "drizzle-orm/expressions.js";

export async function runSQL(message: Message) {
    if (!isBotOwner(message.author)) return;
    const content = message.content.split(" ");

    const query = content.slice(1).join(" ");

    if (query.length === 0) return await message.channel.send("You need to provide a query yknow");

    const result = await PSConnection.execute(query);

    if (content[1].toLowerCase() === "select") {
        await message.channel.send(`\`\`\`json\n${JSON.stringify(result.rows)}\n\`\`\``);
    } else {
        await message.channel.send("Query executed!");
        await message.channel.send(`Rows affected: ${result.rowsAffected}`);
    }
}

export async function insertStatus(message: Message): Promise<void | Message> {
    if (!isBotOwner(message.author)) return;

    const content = message.content.split(" ");

    if (content.length < 3) return await message.channel.send("Invalid syntax!");

    const status = content.slice(2).join(" ");
    const type = content[1].toUpperCase();

    if (!(type in StatusType)) return await message.channel.send("Invalid type!");

    if (isDev()) {
        await message.channel.send(
            "Add your statuses to the main db instead <:emiliaSMH:747132102645907587>"
        );
    }

    const document = { type, status } as Status;

    await db.insert(statuses).values(document);

    statusArr.push(document);

    await message.channel.send("Status added!");
    await message.channel.send(`\`\`\`json\n${JSON.stringify(document, null, 4)}\n\`\`\``);
}

export async function updatePrefix(message: Message) {
    if (
        !hasPermission(PermissionFlagsBits.KickMembers, message) &&
        !BOT_OWNERS.includes(message.author.id)
    ) {
        return message.channel.send("Insufficient permissions!");
    }

    const content = message.content.split(" ");

    // Syntax check as well as avoiding cluttering the database with long impractical prefixes
    if (content.length !== 2) return await message.channel.send("Invalid syntax");
    if (content[1].length > 10)
        return await message.channel.send("Your prefix may only be 10 characters long at most");

    if (isDev()) await message.channel.send("Wrong database <:emiliaSMH:747132102645907587>");

    // Finds the guild's document in the database
    // Updates said document with the new prefix
    if (message.guild === null)
        return await message.channel.send("This command can only be used in a server!");

    const serverId = message.guild.id;
    try {
        await db
            .update(prefixes)
            .set({ prefix: content[1] })
            .where(eq(prefixes.serverId, serverId))
            .execute();
    } catch (_) {
        return await message.channel.send("Couldn't update prefix, maybe try again later");
    }
    prefixMap.set(serverId, content[1]);
    return await message.channel.send(`Updated prefix for this server to \`${content[1]}\`!`);
}
