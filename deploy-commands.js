import { SlashCommandBuilder, SlashCommandSubcommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { credentials } from './config.js';

const commands = [
	new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Replies with user avatar!')
    .addUserOption(option => option.setName('user').setDescription('The user to get the avatar of').setRequired(false))
    .addStringOption(option => option.setName('userid').setDescription("The id of the user you're getting the avatar of").setRequired(false)),

    new SlashCommandBuilder()
    .setName('convert')
    .setDescription('Converts from one currency to another!')
    .addNumberOption(option => option.setName('amount').setDescription("The amount of money you're converting").setRequired(true))
    .addStringOption(option => option.setName('from').setDescription("The currency you're converting from").setRequired(true))
    .addStringOption(option => option.setName('to').setDescription("The currency you're converting to").setRequired(true)),

    new SlashCommandBuilder()
    .setName('emoji')
    .setDescription('Manage custom emojis!')

        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('add')
            .setDescription('Add a custom emoji!')
            .addStringOption(option => option.setName('name').setDescription("The name of the emoji").setRequired(true))
            .addStringOption(option => option.setName('source').setDescription("The url or emoji to use for the custom emoji").setRequired(true)))

        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('remove')
            .setDescription('Remove a custom emoji!')
            .addStringOption(option => option.setName('emoji').setDescription("The emoji you want to remove").setRequired(true)))

        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('rename')
            .setDescription('Rename a custom emoji!')
            .addStringOption(option => option.setName('emoji').setDescription("The emoji you want to rename").setRequired(true))
            .addStringOption(option => option.setName('newname').setDescription("The new name of the emoji").setRequired(true))),

    new SlashCommandBuilder()
    .setName('imgur')
    .setDescription('Uploads an image to imgur!')
    .addStringOption(option => option.setName('url').setDescription("The url of the image you want to upload").setRequired(true)),

    new SlashCommandBuilder()
    .setName('urban')
    .setDescription("Gets the definition of a word!")
    .addStringOption(option => option.setName('word').setDescription("The word you want to get the definition of").setRequired(true)),

    new SlashCommandBuilder()
    .setName('resize')
    .setDescription("Resizes an image!")
    .addStringOption(option => option.setName('url').setDescription("The url of the image you want to resize").setRequired(true))
    .addIntegerOption(option => option.setName('width').setDescription("The width of the image you want to resize").setRequired(true)),

    new SlashCommandBuilder()
    .setName('beautiful')
    .setDescription("Show someone how beautiful they are!")
    .addUserOption(option => option.setName('user').setDescription("The user you want to show").setRequired(false))
    .addStringOption(option => option.setName('userid').setDescription("The ID of a user you want to show").setRequired(false)),

    new SlashCommandBuilder()
    .setName('reddit')
    .setDescription("Get a random post from a subreddit!")

        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('profile')
            .setDescription('Gets a reddit user\'s profile!')
            .addStringOption(option => option.setName('username').setDescription("The user you want to get the profile of").setRequired(true)))

        .addSubcommand(new SlashCommandSubcommandBuilder()
            .setName('image')
            .setDescription("Gets a random image from a subreddit!")
            .addStringOption(option => option.setName('subreddit').setDescription("The subreddit you want to get a random image from").setRequired(true))
            .addBooleanOption(option => option.setName('nsfw').setDescription("Whether or not the image should be NSFW").setRequired(false))
            .addBooleanOption(option => option.setName('force').setDescription("Force images to be fetched first").setRequired(false))),

    
]
	.map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(credentials['token']);

rest.put(Routes.applicationGuildCommands(credentials['clientId'], credentials['guildId']), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);


export { commands, rest };