const { Client, Intents, MessageEmbed } = require('discord.js');
const { token, exchangeApiKey } = require('./config.json');
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });
const tools = require('./tools.js');
const emoji = require('./emoji.js');
const reddit = require('./reddit.js');
const imgProcess = require('./imgProcess.js')
const https = require('https');
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

	} else if (commandName === 'profile') {
		await reddit.profile(interaction);

	} else if (commandName === 'urban') {
		await urban(interaction);
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

	https.get(`https://prime.exchangerate-api.com/v5/${exchangeApiKey}/latest/${from}`, (res) => {
		res.on('error', (e) => {
			console.log('error:', e);
			interaction.reply("An unknown error has occurred!")
		})
		let data = '';
		res.on('data', (chunk) => {
			data+=chunk;
		});
		res.on('end', () => {
			const result = JSON.parse(data);
		
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

		)}
	);				
}


async function urban(interaction) {
	const query = interaction.options.getString('word');
	const url = `https://api.urbandictionary.com/v0/define?term=${query}`;

	https.get(url, (res) => {
		res.on('error', (e) => {
			console.log('error:', e);
			interaction.reply("An unknown error has occurred!")
		})
		let data = '';
		res.on('data', (chunk) => {
			data+=chunk;
		});
		res.on('end', () => {
			const result = JSON.parse(data);
			
			if (result['list'] === undefined) {
				interaction.reply("No results found!");
				return;
			}

			const def = result['list'][0];
			if (def === undefined) {
				interaction.reply("No results found!");
				return;
			}
			
			const word = def['word'];
			const definition = def['definition'];
			const example = def['example'];
			const author = def['author'];
			const permalink = def['permalink'];

			const urbanEmbed = new MessageEmbed()
				.setColor(embedColour)
				.setTitle(`*${word}*`)
				.setDescription(`${definition}\n\nExample: ${example}\n\n**Author:** ${author}\n\n**Permalink:** [${permalink}](${permalink})`)
				.setFooter({text: `${tools.strftime("%d/%m/%Y %H:%M:%S")}`})

			interaction.reply({embeds: [urbanEmbed]});
		}

		)}
	);				
}

client.login(token);