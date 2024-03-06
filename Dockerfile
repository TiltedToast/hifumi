FROM oven/bun:latest

WORKDIR /hifumi
ENV DOCKER true
COPY . .

RUN apt-get update && \
    apt-get install -y git &&  \
    apt-get install -y imagemagick && \
    bun install

STOPSIGNAL SIGINT

CMD [ "bun", "./src/app.ts" ]