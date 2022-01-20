const { Client, Intents, MessageEmbed } = require('discord.js');
const { token, exchangeApiKey } = require('./config.json');
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });
const tools = require('./tools.js');
const emoji = require('./emoji.js');
const imgProcess = require('./imgProcess.js')
const request = require('request');
const embedColour = '0xce3a9b';

const startTime = Date.now();

client.once('ready', () => {
	time = tools.strftime("%d/%m/%Y %H:%M:%S");
	doneLoadingTime = Date.now();

	console.log(`Started up in ${(doneLoadingTime - startTime)/ 1000} seconds on ${time}`);
	console.log("Logged in as:");
	console.log(client.user.username);
	console.log(client.user.id);
	console.log('------');

	// let channel = client.channels.cache.get('655484804405657642');
	// channel.send(`Logged in as:\n${client.user.username}\nTime: ${time}\n--------------------------`);
	client.user.setActivity("with best girl Annie!", { type: "PLAYING" })
});


client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	const { commandName } = interaction;
	
	if (commandName === 'ping') {
		await interaction.reply('Pong!');
	
	} else if (commandName === 'server') {
		await server(interaction);

	} else if (commandName === 'avatar') {
		await avatarURL(interaction);

	} else if (commandName === 'convert') {
		await convert(interaction);
		
	} else if (commandName === 'emoji') {
		if (interaction.options.getSubcommand() === 'add') {
			await emoji.addEmoji(interaction);
		} else if (interaction.options.getSubcommand() === 'remove') {
			await emoji.removeEmoji(interaction);
		} else if (interaction.options.getSubcommand() === 'rename') {
			await emoji.renameEmoji(interaction);
		}
	
	} else if (commandName === 'imgur') {
		await imgProcess.imgur(interaction);
	}
});


async function server(interaction) {
	guildOwner = (await client.users.fetch(interaction.guild.ownerId)).username;
	guildName = interaction.guild.name;
	guildMembers = interaction.guild.memberCount;
	guildIcon = interaction.guild.iconURL;

	const serverEmbed = new MessageEmbed()
		.setColor(embedColour)
		.setTitle(`Server Info for ${guildName}`)
		.setThumbnail(guildIcon)
		.setDescription(`Server Owner: ${guildOwner}\nTotal Members: ${guildMembers}`)

	interaction.reply({embeds: [serverEmbed]});
	
	
}


async function avatarURL(interaction) {

	const optionsArray = tools.getOptionsArray(interaction.options.data);

	try {
		if (optionsArray.length === 0) {
			user = interaction.user;
	
		} else if (optionsArray.includes("user") && !optionsArray.includes("userid")) {
			user = interaction.options.getUser('user');
	
		} else if (optionsArray.includes("userid") && !optionsArray.includes("user")) {
			user = await client.users.fetch(interaction.options.getString('userid'));
	
		} else if (optionsArray.includes("user") && optionsArray.includes("userid")) {
			user = interaction.options.getUser('user');
		}
	}
	catch (DiscordAPIError) {
		interaction.reply('User not found!');
		return;
	}


	const userID = user.id;
	const userName = user.username;
	const avatarHash = user.avatar;
	
	
	if (user.avatarURL({ dynamic: true }).includes("gif")) {
		url = `https://cdn.discordapp.com/avatars/${userID}/${avatarHash}.gif?size=4096`
	} else {
		url = `https://cdn.discordapp.com/avatars/${userID}/${avatarHash}.png?size=4096`
	}

	const avatarEmbed = new MessageEmbed()
		.setColor(embedColour)
		.setTitle(`*${userName}'s Avatar*`)
		.setImage(url)

	interaction.reply({embeds: [avatarEmbed]});
}


async function convert(interaction) {
	const amount = parseFloat(interaction.options.getNumber('amount'));
	const from = interaction.options.getString('from').toUpperCase();
	const to = interaction.options.getString('to').toUpperCase();

	request.get(`https://prime.exchangerate-api.com/v5/${exchangeApiKey}/latest/${from}`, function (error, response, body) {
		if (error) {
			console.log('error:', error);
			interaction.reply("An unknown error has occurred!")

		} else if (response.statusCode !== 200) {
			console.log('statusCode:', response.statusCode);
			interaction.reply("An unknown error has occurred!")

		} else {
			const result = JSON.parse(body);
			
			// Checks for invalid inputs
			if (result['conversion_rates'] === undefined) {
				interaction.reply("At least one of your currencies is not supported!");
				return;

			} else if (!result['conversion_rates'].hasOwnProperty(to)) {
				interaction.reply("Your second currency is not supported!");
				return;

			} else if (from === to) {
				interaction.reply("Your first currency is the same as your second currency!");
				return;

			} else if (amount < 0) {
				interaction.reply("You can't convert a negative amount!");
				return;

			} else if (amount === 0) {
				interaction.reply("Zero will obviously stay 0!");
				return;
			}

			const rate = result['conversion_rates'][to];
			rslt = Math.round(amount * rate * 100) / 100;
			description = `**${tools.advRound(amount)} ${from} ≈ ${tools.advRound(rslt)} ${to}**\n\nExchange Rate: 1 ${from} ≈ ${rate} ${to}`;

			const convertEmbed = new MessageEmbed()
				.setColor(embedColour)
				.setTitle(`Converting ${from} to ${to}`)
				.setDescription(description)
				.setFooter({text: `${tools.strftime("%d/%m/%Y %H:%M:%S")}`})
			
			interaction.reply({embeds: [convertEmbed]});

		}
	});				
}

client.login(token);