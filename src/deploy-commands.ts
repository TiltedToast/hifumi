import {
    ApplicationCommandType,
    ApplicationIntegrationType,
    ContextMenuCommandBuilder,
    InteractionContextType,
    PermissionFlagsBits,
    REST,
    Routes,
    SlashCommandBuilder,
} from "discord.js";

if (!process.env["BOT_ID"]) throw new Error("You must provide a BOT_ID env variable");

let guildId: string | undefined = undefined;
const clear = process.argv.includes("--clear");

const idx = process.argv.indexOf("--guild");
if (idx !== -1 && idx < process.argv.length - 1) {
    guildId = process.argv[idx + 1];
}

let commands = [
    new SlashCommandBuilder()
        .setName("pat")
        .setDescription("Pats a user")
        .addUserOption((option) =>
            option.setName("user").setDescription("The user to pat").setRequired(true)
        )
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
        .setContexts(InteractionContextType.Guild),

    new SlashCommandBuilder()
        .setName("help")
        .setDescription("Shows a list of commands")
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        )
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        ),

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
        )
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        )
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
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
        )
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        )
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        ),

    new SlashCommandBuilder()
        .setName("convert")
        .setDescription("Converts from one currency to another")
        .addStringOption((option) =>
            option.setName("from").setDescription("The currency to convert from").setRequired(true)
        )
        .addStringOption((option) =>
            option.setName("to").setDescription("The currency to convert to").setRequired(true)
        )
        .addNumberOption((option) =>
            option
                .setName("amount")
                .setDescription("The amount to convert")
                .setRequired(false)
                .setMinValue(Number.MIN_VALUE)
        )
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        )
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        ),

    new SlashCommandBuilder()
        .setName("qr")
        .setDescription("Generates a QR code")
        .addStringOption((option) =>
            option.setName("data").setDescription("The data to encode").setRequired(true)
        )
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        )
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        ),

    new SlashCommandBuilder()
        .setName("pfp")
        .setDescription("Gets the avatar of a user")
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("The user to get the avatar of (You if omitted)")
                .setRequired(false)
        )
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        )
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        ),

    new ContextMenuCommandBuilder()
        .setName("Show Avatar")
        .setType(ApplicationCommandType.User)
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        )
        .setIntegrationTypes(
            ApplicationIntegrationType.UserInstall,
            ApplicationIntegrationType.GuildInstall
        ),

    new SlashCommandBuilder()
        .setName("leet")
        .setDescription("Converts text to leet speak")
        .addStringOption((option) =>
            option.setName("input").setDescription("The text to convert").setRequired(true)
        )
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        )
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        ),

    new SlashCommandBuilder()
        .setName("beautiful")
        .setDescription("Generates a beautiful image")
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("The user to get the avatar of (You if omitted)")
                .setRequired(false)
        )
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        )
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        ),

    new SlashCommandBuilder()
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setName("prefix")
        .setDescription("Updates the prefix for the server")
        .addStringOption((option) =>
            option.setName("prefix").setDescription("The new prefix").setRequired(true)
        )
        .setContexts(InteractionContextType.Guild)
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall),
].map((command) => command.toJSON());

if (process.env.DEV_MODE === "true") {
    commands = commands.map((command) => {
        if (command.type === ApplicationCommandType.ChatInput) {
            command.name = `${command.name}-dev`;
            command.description = `${command.description} (dev)`;
        } else if (command.type) {
            command.name = `${command.name} (dev)`;
        }
        return command;
    });
}

const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);

try {
    if (guildId) {
        await rest.put(Routes.applicationGuildCommands(process.env["BOT_ID"], guildId), {
            body: clear ? [] : commands,
        });
        const msg = clear
            ? "Successfully cleared all commands in your test guild."
            : "Successfully registered all commands in your test guild.";
        console.log(msg);
    } else {
        await rest.put(Routes.applicationCommands(process.env["BOT_ID"]), {
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
