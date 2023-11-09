import { DatabaseError } from "@planetscale/database";
import { Message, PermissionFlagsBits, codeBlock } from "discord.js";
import { table } from "table";
import { fromZodError } from "zod-validation-error";
import { prefixMap, statusArr } from "../app.js";
import { BOT_OWNERS } from "../config.js";
import { PSConnection, db, updatePrefix as updatePrefixDB } from "../db/index.js";
import { statuses } from "../db/schema.js";
import { InsertStatusSchema, Status } from "../db/types.js";
import { hasPermission, isBotOwner, isDev } from "../helpers/utils.js";

const MIN_WRAP_LENGTH = 30;

export async function runSQL(message: Message) {
    if (!isBotOwner(message.author)) return;
    const query = message.content.split(" ").slice(1).join(" ");

    if (query.length === 0) return await message.channel.send("You need to provide a query smh");

    const result = await PSConnection.execute(query)
        .then((res) => res)
        .catch(async (e) => {
            if (e instanceof DatabaseError) {
                await message.channel.send(`Invalid Query\n${e.message}`);
            } else {
                await message.channel.send("Unknown error, check the logs");
            }
            console.error(e);
        });

    if (!result) return;

    if (!query.toLowerCase().startsWith("select")) {
        return await message.channel.send(codeBlock("json", JSON.stringify(result, null, 2)));
    }

    const data = result.rows;

    const keys = Object.keys(data[0]);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    const values = data.map((obj) => Object.values(obj));

    const columns = {} as { [key: number]: { width: number } };

    for (let i = 0; i < values[0].length; i++) {
        const minVal = Math.min(
            MIN_WRAP_LENGTH,
            Math.max(...values.map((v) => String(v[i]).length))
        );
        columns[i] = {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            width: minVal >= keys[i].length ? minVal : keys[i].length,
        };
    }
    let stringified = table([keys, ...values], {
        columnDefault: {
            wrapWord: true,
        },
        columns,
    });

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

    const content = message.content.split(" ");

    if (content.length < 3) return await message.channel.send("Invalid syntax!");

    const document = {
        type: content[1].toUpperCase(),
        status: content.slice(2).join(" "),
    } as Status;

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
            if (e instanceof DatabaseError) {
                if (e.message.includes("AlreadyExists")) {
                    await message.channel.send("Status already exists");
                } else {
                    await message.channel.send("Unknown error, check the logs");
                }
            }
            console.error(e);
        });

    if (!query) return;

    statusArr.push(document);

    await message.channel.send("Status added!");
    await message.channel.send(
        codeBlock("json", JSON.stringify({ ...document, id: query.insertId }, null, 4))
    );
}

export async function updatePrefix(message: Message) {
    if (
        !hasPermission(message.member, PermissionFlagsBits.ManageGuild) &&
        !BOT_OWNERS.includes(message.author.id)
    ) {
        return message.channel.send("Insufficient permissions!");
    }

    const content = message.content.split(" ");

    // Syntax check as well as avoiding cluttering the database with long impractical prefixes
    if (content.length !== 2) return await message.channel.send("Invalid syntax");
    if (content[1].length > 255)
        return await message.channel.send("Your prefix may only be 255 characters long at most");

    if (isDev()) await message.channel.send("Wrong database <:emiliaSMH:747132102645907587>");

    // Finds the guild's document in the database
    // Updates said document with the new prefix
    if (message.guild === null)
        return await message.channel.send("This command can only be used in a server!");

    const serverId = message.guild.id;
    try {
        await updatePrefixDB(serverId, content[1]);
    } catch (_) {
        return await message.channel.send("Couldn't update prefix, maybe try again later");
    }
    prefixMap.set(serverId, content[1]);
    return await message.channel.send(`Updated prefix for this server to \`${content[1]}\`!`);
}
