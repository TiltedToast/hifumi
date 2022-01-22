import * as tools from './tools.js';
import * as emoji from './emoji.js';
import * as imgProcess from './imgProcess.js';
import * as reddit from './reddit.js';
import { credentials } from './config.js';
import { Client, Intents, MessageEmbed } from 'discord.js';

const allIntents = new Intents(32767);
const client = new Client({ intents: allIntents });


const startTime = Date.now();

client.once('ready', () => {
	const time = tools.strftime("%d/%m/%Y %H:%M:%S");
	const doneLoadingTime = Date.now();

	console.log(`Started up in ${(doneLoadingTime - startTime)/ 1000} seconds on ${time}`);
	console.log("Logged in as:");
	console.log(client.user.username);
	console.log(client.user.id);
	console.log('------');

	// const channel = client.channels.cache.get('655484804405657642');
	// channel.send(`Logged in as:\n${client.user.username}\nTime: ${time}\n--------------------------`);
	client.user.setActivity("with best girl Annie!", { type: "PLAYING" })
});


client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	const { commandName } = interaction;
	
	if (commandName === 'avatar') {
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
		
	} else if (commandName === 'resize') {
		await imgProcess.resizeImg(interaction);
		
	}
});


async function avatarURL(interaction) {

	const optionsArray = getOptionsArray(interaction.options.data);

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
		return interaction.reply('User not found!');
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
		.setColor(credentials['embedColour'])
		.setTitle(`*${userName}'s Avatar*`)
		.setImage(url)

	interaction.reply({embeds: [avatarEmbed]});
}


async function convert(interaction) {
	const amount = parseFloat(interaction.options.getNumber('amount'));
	const from = interaction.options.getString('from').toUpperCase();
	const to = interaction.options.getString('to').toUpperCase();

	get(`https://prime.exchangerate-api.com/v5/${credentials['exchangeApiKey']}/latest/${from}`, (res) => {
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
				return interaction.reply("At least one of your currencies is not supported!");

			} else if (!result['conversion_rates'].hasOwnProperty(to)) {
				return interaction.reply("Your second currency is not supported!");

			} else if (from === to) {
				return interaction.reply("Your first currency is the same as your second currency!");

			} else if (amount < 0) {
				return interaction.reply("You can't convert a negative amount!");

			} else if (amount === 0) {
				return interaction.reply("Zero will obviously stay 0!");
				
			}

			const rate = result['conversion_rates'][to];
			rslt = Math.round(amount * rate * 100) / 100;
			description = `**${advRound(amount)} ${from} ≈ ${advRound(rslt)} ${to}**\n\nExchange Rate: 1 ${from} ≈ ${rate} ${to}`;

			const convertEmbed = new MessageEmbed()
				.setColor(credentials['embedColour'])
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

	get(url, (res) => {
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
				return interaction.reply("No results found!");
			}
			
			const def = result['list'][Math.floor(Math.random() * (Math.ceil(result['list'].length) - 0) + 0)];

			if (def === undefined) {
				return interaction.reply("No results found!");
			}

			const word = def['word'];
			const definition = def['definition']
			const example = def['example'];
			const author = def['author'];
			const permalink = def['permalink'];
			const upvotes = def['thumbs_up'];
			const downvotes = def['thumbs_down'];
			const description = `${definition}\n\n**Example:** ${example}\n\n**Author:** ${author}\n\n**Permalink:** [${permalink}](${permalink})`.replace('/[|]/g', '');

			const urbanEmbed = new MessageEmbed()
				.setColor(credentials['embedColour'])
				.setTitle(`*${word}*`)
				.setDescription(description)
				.setFooter({text: `Upvotes: ${upvotes} Downvotes: ${downvotes}`})

			interaction.reply({embeds: [urbanEmbed]});
		}

		)}
	);				
}

client.login(credentials['token']);