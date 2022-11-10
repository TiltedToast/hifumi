import { SlashCommandBuilder } from "@discordjs/builders";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import "dotenv/config";

const commands = [
    new SlashCommandBuilder()
        .setName("pat")
        .setDescription("Pats a user")
        .addUserOption((option) =>
            option.setName("user").setDescription("The user to pat").setRequired(true)
        ),
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env["BOT_TOKEN"] ?? "");

rest.put(Routes.applicationCommands(process.env["BOT_ID"] ?? ""), {
    body: commands,
})
    .then(() => console.log("Successfully registered application commands."))
    .catch(console.error);

export { commands, rest };
