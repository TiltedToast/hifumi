import * as tools from './tools.js';
import { credentials } from './config.js'
import Snoowrap from 'snoowrap';

const RedditClient = new Snoowrap({
    userAgent: 'windows:hifumi:v1.0.0 (by /u/tilted_toast)',
    clientId: credentials['redditClientId'],
    clientSecret: credentials['redditClientSecret'],
    refreshToken: credentials['redditRefreshToken']
});

export async function profile(interaction) {
    userName = interaction.options.getString('username');
    
    RedditClient.getUser(userName).fetch().then(async (user) => {
        userCreatedDate = tools.strftime("%d/%m/%Y", new Date(user.created_utc * 1000));
        const description = `[Link to profile](https://www.reddit.com/user/${user.name})\n
                        Post Karma: ${user.link_karma.toLocaleString()}\n
                        Comment Karma: ${user.comment_karma.toLocaleString()}\n
                        Created on: ${userCreatedDate}\n`;

        const profileEmbed = new MessageEmbed() 
            .setColor(credentials['embedColour'])
            .setTitle(`${user.name}'s profile`)
            .setDescription(description)
            .setThumbnail(user.icon_img)
        
        await interaction.reply({embeds: [profileEmbed]});
    })

}