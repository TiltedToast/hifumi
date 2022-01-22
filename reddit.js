import * as tools from './tools.js';
import { credentials } from './config.js'
import Snoowrap from 'snoowrap';
import { MessageEmbed } from "discord.js";
import fetch from 'node-fetch';

const RedditClient = new Snoowrap({
    userAgent: 'windows:hifumi:v1.0.0 (by /u/tilted_toast)',
    clientId: credentials['redditClientId'],
    clientSecret: credentials['redditClientSecret'],
    refreshToken: credentials['redditRefreshToken']
});

export async function profile(interaction) {
    const userName = interaction.options.getString('username');
    await interaction.deferReply();

    const response = await fetch(`https://www.reddit.com/user/${userName}/about.json`)
    if (response.status !== 200) {return interaction.editReply(`User not found!`)}

    RedditClient.getUser(userName).fetch().then(async (user) => {
        const userCreatedDate = tools.strftime("%d/%m/%Y", new Date(user.created_utc * 1000));
        const description = `[Link to profile](https://www.reddit.com/user/${user.name})
                        Post Karma: ${user.link_karma.toLocaleString()}
                        Comment Karma: ${user.comment_karma.toLocaleString()}
                        Created on: ${userCreatedDate}`;

        const profileEmbed = new MessageEmbed() 
            .setColor(credentials['embedColour'])
            .setTitle(`${user.name}'s profile`)
            .setDescription(description)
            .setThumbnail(user.icon_img)
        
        await interaction.editReply({embeds: [profileEmbed]});
    });
}


export async function subImg(interaction) {

}

export async function subText(interaction) {

}

export async function fetchSubmissions(subreddit, limit=100) {

}