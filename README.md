# Deploying her yourself
The main thing you will have to add is a `config.ts` file that looks as follows:

```ts
export const credentials = {
    token: "YOUR DISCORD BOT TOKEN ",
    clientId: "THE CLIENT ID OF YOUR BOT",
    exchangeApiKey: "API KEY FOR https://www.exchangerate-api.com/",
    imgurClientId: "IMGUR APP CLIENT ID",
    imgurClientSecret: "IMGUR APP CLIENT SECRET",
    redditClientId: "REDDIT APP CLIENT ID",
    redditClientSecret: "REDDIT APP CLIENT SECRET",
    redditRefreshToken: "REDDIT APP REFRESH TOKEN",
    mongoURI: "CONNECTION URI TO MONGODB DATABASE"
}
```
You can use pm2 or any other process manager to manage reloading during runtime.

Just make sure to install it first, in the case of pm2 that would be `npm install -g pm2`.

Alternatively you can also just use the provided Dockerfile to run her in an isolated container and manage things that way of course
