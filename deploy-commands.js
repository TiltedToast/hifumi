const { SlashCommandBuilder, SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { clientId, guildId, token } = require('./config.json');

const commands = [
	new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with pong!'),

	new SlashCommandBuilder()
    .setName('server')
    .setDescription('Replies with server info!'),

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
    .addStringOption(option => option.setName('url').setDescription("The url of the image you want to upload").setRequired(true))
    

    
]
	.map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(token);

rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);