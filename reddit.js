const tools = require('./tools.js');
const { redditClientId, redditClientSecret, redditRefreshToken } = require('./config.json');
const snoowrap = require('snoowrap');
const embedColour = '0xce3a9b';

const RedditClient = new snoowrap({
    userAgent: 'windows:hifumi:v1.0.0 (by /u/tilted_toast)',
    clientId: redditClientId,
    clientSecret: redditClientSecret,
    refreshToken: redditRefreshToken
});

async function profile(interaction) {
    userName = interaction.options.getString('username');
    
    RedditClient.getUser(userName).fetch().then(async (user) => {
        userCreatedDate = tools.strftime("%d/%m/%Y %H:%M:%S", new Date(user.created_utc * 1000));
    })


    const description = `[Link to profile](https://www.reddit.com/user/${user.name})\n
                        Post Karma: ${user.link_karma.toLocaleString()}\n
                        Comment Karma: ${user.comment_karma.toLocaleString()}\n
                        Created on: ${userCreatedDate}\n`;

    const profileEmbed = new MessageEmbed() 
        .setColor(embedColour)
        .setTitle(`${user.name}'s profile`)
        .setDescription(description)
        .setThumbnail(user.icon_img)
    
    await interaction.reply({embeds: [profileEmbed]});

}

module.exports = {
    profile
}