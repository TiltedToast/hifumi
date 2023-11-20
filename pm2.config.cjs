// https://pm2.keymetrics.io/docs/usage/application-declaration/
module.exports = {
    name: "hifumi",
    script: "./dist/app.js",
    time: true,
    env: {
        NODE_ENV: "production",
    },
    merge_logs: true,
};
