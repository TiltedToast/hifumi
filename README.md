# Deploying her yourself
The main thing you will have to add is a `.env` file in the root directory that looks as follows:

```.env
BOT_TOKEN="YOUR DISCORD BOT TOKEN"
EXCHANGE_API_KEY="API KEY FOR https://www.exchangerate-api.com/"
IMGUR_CLIENT_ID="IMGUR APP CLIENT ID"
IMGUR_CLIENT_SECRET="IMGUR APP CLIENT SECRET"
REDDIT_CLIENT_ID="ra7W9w_QZhwRaA"
REDDIT_CLIENT_SECRET="REDDIT APP CLIENT ID"
REDDIT_REFRESH_TOKEN="REDDIT APP REFRESH TOKEN"
MONGO_URI="CONNECTION URI TO MONGODB DATABASE"
DEV_MODE="true or false"
```

You can use pm2 or any other process manager to manage reloading during runtime.

Just make sure to install it first, in the case of pm2 that would be `npm install -g pm2`.

Alternatively you can also just use the provided Dockerfile to run her in an isolated container and manage things that way of course
