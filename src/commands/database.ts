import { LibsqlError } from "@libsql/client";
import { ChatInputCommandInteraction, Message, PermissionFlagsBits, codeBlock } from "discord.js";
import { fromZodError } from "zod-validation-error";
import { db, dbClient, updatePrefix as updatePrefixDB } from "../db/index.ts";
import { statuses } from "../db/schema.ts";
import { InsertStatusSchema, type NewStatus } from "../db/types.ts";
import { prefixMap } from "../handlers/prefixes.ts";
import { statusArr } from "../handlers/statuses.ts";
import {
    formatTable,
    hasPermission,
    isBotOwner,
    isChatInputCommandInteraction,
    isDev,
    sendOrReply,
} from "../helpers/utils.ts";

export async function runSQL(message: Message) {
    if (!isBotOwner(message.author)) return;
    const query = message.content.split(" ").slice(1).join(" ");

    if (query.length === 0) return await message.channel.send("You need to provide a query smh");

    const result = await dbClient
        .execute(query)
        .then((res) => res)
        .catch(async (e) => {
            if (e instanceof LibsqlError) {
                await message.channel.send(`Invalid Query\n${e.message}`);
                return;
            } else {
                await message.channel.send("Unknown error, check the logs");
            }
            console.error(e);
        });

    if (!result) return;

    if (!query.toLowerCase().startsWith("select")) {
        return await message.channel.send(codeBlock("json", JSON.stringify(result, null, 2)));
    }

    if (result.rows.length === 0) return await message.channel.send("No results found!");

    let stringified = formatTable(result.rows);

    // If the nice table is too long, just send the raw JSON
    if (stringified.length > 2000) {
        stringified = JSON.stringify(result.rows);
    }

    if (stringified.length > 2000) {
        console.error(stringified);
        return await message.channel.send("The result is too long to be displayed, check the logs");
    }

    await message.channel.send(
        stringified.startsWith("{") || stringified.startsWith("[")
            ? codeBlock("json", stringified)
            : codeBlock(stringified)
    );
}

export async function insertStatus(message: Message): Promise<undefined | Message> {
    if (!isBotOwner(message.author)) return;

    const content = message.content.split(" ").filter(Boolean);

    if (content.length < 3) return await message.channel.send("Invalid syntax!");

    const document = {
        type: content[1].toUpperCase(),
        status: content.slice(2).join(" "),
    } as NewStatus;

    const result = InsertStatusSchema.safeParse(document);

    if (!result.success) {
        const error = fromZodError(result.error, {
            issueSeparator: "\n- ",
            prefix: "Invalid status",
            prefixSeparator: "\n- ",
            unionSeparator: "\n",
        });

        return await message.channel.send(error.message);
    }

    if (isDev()) {
        await message.channel.send(
            "Add your statuses to the main db instead <:emiliaSMH:747132102645907587>"
        );
    }

    const query = await db
        .insert(statuses)
        .values(document)
        .catch(async (e) => {
            if (e instanceof LibsqlError) {
                if (e.message.includes("UNIQUE constraint failed")) {
                    await message.channel.send("Status already exists");
                    return;
                } else {
                    await message.channel.send("Unknown error, check the logs");
                }
            }
            console.error(e);
        });

    if (!query) return;

    const newStatus = {
        id: Number(query.lastInsertRowid),
        ...document,
    };

    statusArr.push(newStatus);

    const formattedDoc = formatTable([newStatus]);

    await message.channel.send("Status added!");
    await message.channel.send(codeBlock(formattedDoc));
}

export async function updatePrefix(input: Message | ChatInputCommandInteraction) {
    if (isChatInputCommandInteraction(input)) {
        if (
            !input.memberPermissions?.has(PermissionFlagsBits.ManageGuild) &&
            !isBotOwner(input.user)
        ) {
            return await sendOrReply(input, "Insufficient permissions!", true);
        }
    } else {
        if (
            !hasPermission(input.member, PermissionFlagsBits.ManageGuild) &&
            !isBotOwner(input.author)
        ) {
            return await input.channel.send("Insufficient permissions!");
        }
    }

    let newPrefix: string;

    if (isChatInputCommandInteraction(input)) {
        newPrefix = input.options.getString("prefix", true);
    } else {
        const content = input.content.split(" ").filter(Boolean);
        if (content.length !== 2) return await input.channel.send("Invalid syntax");
        newPrefix = content[1];
    }

    if (newPrefix.length > 255) {
        return await sendOrReply(input, "Your prefix may only be 255 characters long at most");
    }

    if (isDev()) await input.channel?.send("Wrong database <:emiliaSMH:747132102645907587>");

    // Finds the guild's document in the database
    // Updates said document with the new prefix
    if (input.guild === null) {
        return await sendOrReply(input, "This command can only be used in a server!");
    }

    const serverId = input.guild.id;
    try {
        await updatePrefixDB(serverId, newPrefix);
    } catch (e) {
        console.error(e);
        return await sendOrReply(input, "Couldn't update prefix, maybe try again later");
    }
    prefixMap.set(serverId, newPrefix);
    return await sendOrReply(input, `Updated prefix for this server to \`${newPrefix}\`!`, false);
}
