FROM node:lts

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /hifumi
ENV DOCKER true
COPY . .

RUN pnpm install \
    && ./node_modules/.bin/tsc

STOPSIGNAL SIGINT

CMD [ "node", "./dist/app.js" ]