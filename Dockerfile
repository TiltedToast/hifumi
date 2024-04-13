FROM oven/bun:latest AS build

WORKDIR /build
COPY . .

RUN apt update
RUN apt install -y git
RUN apt install -y imagemagick
RUN bun install

FROM oven/bun:latest

WORKDIR /hifumi
ENV DOCKER true

COPY --from=build /build .

STOPSIGNAL SIGINT

CMD [ "bun", "./src/app.ts" ]