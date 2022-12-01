import { SlashCommandBuilder } from "@discordjs/builders";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import "dotenv/config";

let guildId;
const clear = process.argv.includes("--clear");

if (process.argv.includes("--guild")) {
    const idx = process.argv.indexOf("--guild");
    if (idx !== -1 && idx < process.argv.length - 1) {
        guildId = process.argv[idx + 1];
    }
}

const commands = [
    new SlashCommandBuilder()
        .setName("pat")
        .setDescription("Pats a user")
        .addUserOption((option) =>
            option.setName("user").setDescription("The user to pat").setRequired(true)
        ),
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env["BOT_TOKEN"] ?? "");

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
