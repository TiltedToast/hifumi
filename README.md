# Deploying her yourself

The main thing you will have to add is a `.env` file in the root directory that looks as follows:

```.env
BOT_TOKEN="YOUR DISCORD BOT TOKEN"
BOT_ID="DISCORD BOT ID"
EXCHANGE_API_KEY="API KEY FOR https://www.exchangerate-api.com/"
IMGUR_CLIENT_ID="IMGUR APP CLIENT ID"
IMGUR_CLIENT_SECRET="IMGUR APP CLIENT SECRET"
REDDIT_CLIENT_ID="REDDIT APP CLIENT ID"
REDDIT_CLIENT_SECRET="REDDIT APP CLIENT SECRET"
REDDIT_REFRESH_TOKEN="REDDIT APP REFRESH TOKEN"
PLANETSCALE_URL="CONNECTION STRING TO PLANETSCALE DATABASE"
WOLFRAM_ALPHA_APP_ID="WOLFRAM ALPHA APP ID"
DEV_MODE="true or false"
```

You can use pm2 or any other process manager to manage reloading during runtime.

Just make sure to install it first, in the case of pm2 that would be `pnpm install -g pm2`.

Alternatively you can also just use the provided docker files to run her in an isolated container and manage things that way of course.

You'll also need to have [imagemagick](https://imagemagick.org/script/download.php) and [gifsicle](https://www.lcdf.org/gifsicle/) installed to be able to resize images & gifs which is required by multiple commands
