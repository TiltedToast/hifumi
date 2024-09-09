import {
    type ButtonInteraction,
    type ChatInputCommandInteraction,
    type Interaction,
    type MessageContextMenuCommandInteraction,
    PartialGroupDMChannel,
    type UserContextMenuCommandInteraction,
    codeBlock,
    userMention,
} from "discord.js";
import { updatePrefix } from "../commands/database.ts";
import { beautiful, qrCode } from "../commands/imgProcess.ts";
import {
    avatar,
    convert,
    helpCmd,
    leet,
    patUser,
    urban,
    urbanEmbeds,
} from "../commands/miscellaneous.ts";
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
        if (interaction.isButton()) {
            await handleButtonInteraction(interaction);
        } else if (interaction.isChatInputCommand()) {
            await handleCommandInteraction(interaction, interaction.options.getSubcommand(false));
        } else if (interaction.isUserContextMenuCommand()) {
            console.log(interaction.commandName);
            await handleUserContextMenuInteraction(interaction);
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

        const channel = DEV_CHANNELS.includes(interaction.channelId ?? "")
            ? interaction.channel
            : await interaction.client.channels.fetch(LOG_CHANNEL);

        if (!channel?.isTextBased() || channel instanceof PartialGroupDMChannel) return;

        if (!interaction.isChatInputCommand()) return;
        await channel.send(
            `${codeBlock("js", `${error as string}`)}\n${userMention(BOT_OWNERS.primary)}`
        );
    }
}

async function handleButtonInteraction(interaction: ButtonInteraction) {
    const identifier = `${interaction.user.id}-${interaction.channelId}` as const;
    if ([`prevUrban-${identifier}`, `nextUrban-${identifier}`].includes(interaction.customId)) {
        await updateEmbed({
            interaction,
            embedArray: urbanEmbeds[identifier]!,
            prevButtonId: `prevUrban-${identifier}`,
            nextButtonId: `nextUrban-${identifier}`,
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
const chatInputCommands = new Map<ChatInputCommandName, ChatInputCommandFn>([
    [".pat", patUser],
    [".help", helpCmd],
    [".sub", sub],
    [".urban", urban],
    [".convert", convert],
    [".qr", qrCode],
    [".pfp", avatar],
    [".leet", leet],
    [".beautiful", beautiful],
    [".prefix", updatePrefix],
]);

const devChatInputCommands = new Map<ChatInputCommandName, ChatInputCommandFn>();
for (const [cmd, fn] of chatInputCommands)
    devChatInputCommands.set(`${cmd}${DEV_COMMAND_POSTFIX}`, fn);

async function handleCommandInteraction(
    interaction: ChatInputCommandInteraction,
    subcommand: string | null
) {
    const commandsToCheck = isDev() ? devChatInputCommands : chatInputCommands;
    for (const [cmd, fn] of commandsToCheck) {
        if (
            cmd.includes(`${interaction.commandName}::${subcommand ?? ""}`) ||
            cmd.includes(`.${interaction.commandName}`)
        ) {
            return await fn(interaction);
        }
    }
}

async function handleUserContextMenuInteraction(interaction: UserContextMenuCommandInteraction) {
    const commandName = isDev()
        ? interaction.commandName.replace(DEV_COMMAND_POSTFIX, "")
        : interaction.commandName;

    if (commandName === "Show Avatar") {
        await avatar(interaction);
    }
}
