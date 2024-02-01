// https://pm2.keymetrics.io/docs/usage/application-declaration/
module.exports = {
    name: "hifumi",
    script: "./src/app.ts",
    time: true,
    env: {
        NODE_ENV: "production",
    },
    interpreter: "bun",
    merge_logs: true,
};
