const tools = require('./tools.js');
const snoowrap = require('snoowrap');
const { redditClientId, redditClientSecret, redditRefreshToken } = require('./config.json');

const RedditClient = new snoowrap({
    userAgent: 'Mozilla/5.0',
    clientId: redditClientId,
    clientSecret: redditClientSecret,
    refreshToken: redditRefreshToken
});

async function profile(interaction) {
    userName = interaction.options.getString('username');
    user = RedditClient.getUser(userName);

    console.log(user);
    userURL = `https://reddit.com/user/${userName}`;

}

module.exports = {
    profile
}