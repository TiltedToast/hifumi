import { REST, Routes, SlashCommandBuilder } from "discord.js";
import "dotenv/config";

let guildId;
const clear = process.argv.includes("--clear");

const idx = process.argv.indexOf("--guild");
if (idx !== -1 && idx < process.argv.length - 1) {
    guildId = process.argv[idx + 1];
}

const commands = [
    new SlashCommandBuilder()
        .setName("pat")
        .setDescription("Pats a user")
        .addUserOption((option) =>
            option.setName("user").setDescription("The user to pat").setRequired(true)
        ),

    new SlashCommandBuilder().setName("help").setDescription("Shows a list of commands"),

    new SlashCommandBuilder()
        .setName("sub")
        .setDescription("Get a random image from a subreddit")
        .addStringOption((option) =>
            option
                .setName("subreddit")
                .setDescription("The subreddit to search in")
                .setRequired(true)
        )
        .addBooleanOption((option) =>
            option
                .setName("nsfw")
                .setDescription("Whether to fetch only NSFW posts")
                .setRequired(false)
        )
        .addBooleanOption((option) =>
            option.setName("force").setDescription("Force fetch posts").setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("urban")
        .setDescription("Searches for a term on Urban Dictionary")
        .addStringOption((option) =>
            option.setName("term").setDescription("The term to search for").setRequired(false)
        )
        .addBooleanOption((option) =>
            option
                .setName("random")
                .setDescription("Whether to search for random terms")
                .setRequired(false)
        ),
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);

try {
    if (guildId) {
        await rest.put(Routes.applicationGuildCommands(process.env["BOT_ID"] ?? "", guildId), {
            body: clear ? [] : commands,
        });
        const msg = clear
            ? "Successfully cleared all commands in your test guild."
            : "Successfully registered all commands in your test guild.";
        console.log(msg);
    } else {
        await rest.put(Routes.applicationCommands(process.env["BOT_ID"] ?? ""), {
            body: clear ? [] : commands,
        });
        const msg = clear
            ? "Successfully cleared all commands globally."
            : "Successfully registered all commands globally.";
        console.log(msg);
    }
} catch (error) {
    console.error(error);
}
