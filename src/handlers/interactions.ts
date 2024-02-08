import {
    ButtonInteraction,
    ChatInputCommandInteraction,
    type Interaction,
    codeBlock,
    userMention,
} from "discord.js";
import { convert, helpCmd, patUser, urban, urbanEmbeds } from "../commands/miscellaneous.ts";
import { sub } from "../commands/reddit.ts";
import {
    BOT_OWNERS,
    DEV_CHANNELS,
    DEV_COMMAND_POSTFIX,
    LOG_CHANNEL,
    OWNER_NAME,
} from "../config.ts";
import { isDev, updateEmbed } from "../helpers/utils.ts";

export default async function handleInteraction(interaction: Interaction) {
    try {
        if (interaction.isButton()) await handleButtonInteraction(interaction);
        if (interaction.isChatInputCommand()) {
            await handleCommandInteraction(interaction, interaction.options.getSubcommand(false));
        }
    } catch (error) {
        console.error(error);

        const msg = `Congratulations, you broke me! Or maybe it was discord, who knows? Either way, I'm broken now. Please try again later or contact my owner \`${OWNER_NAME}\` if it keeps happening.`;

        if (interaction.isChatInputCommand()) {
            if (interaction.deferred) {
                await interaction.editReply(msg);
            } else {
                await interaction.reply({ content: msg, ephemeral: true });
            }
        }

        const channel = DEV_CHANNELS.includes(interaction.channel?.id ?? "")
            ? interaction.channel
            : await interaction.client.channels.fetch(LOG_CHANNEL);

        if (!channel?.isTextBased()) return;

        if (!interaction.isChatInputCommand()) return;
        await channel.send(
            codeBlock("js", `${error as string}`) + `\n${userMention(BOT_OWNERS[0])}`
        );
    }
}

async function handleButtonInteraction(interaction: ButtonInteraction) {
    if (["prevUrban", "nextUrban"].includes(interaction.customId)) {
        await updateEmbed({
            interaction,
            embedArray: urbanEmbeds,
            prevButtonId: "prevUrban",
            nextButtonId: "nextUrban",
            user: interaction.user,
        });
    }
}

type ChatInputCommandFn = (interaction: ChatInputCommandInteraction) => Promise<unknown>;
type ChatInputCommandName = `${string}::${string}` | `.${string}`;

/**
 * Map of commands and their functions.
 *
 * There are two ways to use this map:
 * 1. The command is a single word, prefixed with a `.`, e.g. `".pat"`
 * 2. The command is a combination of two words, e.g. `"emoji::add"`
 *
 * The first word is the command, the second word is the subcommand.
 * I don't know if this is the best way to do this, but it'll do for now
 */
const commands = new Map<ChatInputCommandName, ChatInputCommandFn>([
    [".pat", patUser],
    [".help", helpCmd],
    [".sub", sub],
    [".urban", urban],
    [".convert", convert],
]);

const devCommands = new Map<ChatInputCommandName, ChatInputCommandFn>();
for (const [cmd, fn] of commands) devCommands.set(`${cmd}${DEV_COMMAND_POSTFIX}`, fn);

async function handleCommandInteraction(
    interaction: ChatInputCommandInteraction,
    subcommand: string | null
) {
    const commandsToCheck = isDev() ? devCommands : commands;
    for (const [cmd, fn] of commandsToCheck) {
        if (
            cmd.includes(`${interaction.commandName}::${subcommand ?? ""}`) ||
            cmd.includes(`.${interaction.commandName}`)
        ) {
            return await fn(interaction);
        }
    }
}
