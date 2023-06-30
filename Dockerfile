FROM node:lts

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /hifumi
ENV DOCKER true
COPY package.json .

ENV GIFSICLE_VERSION 1.94
RUN wget https://www.lcdf.org/gifsicle/gifsicle-${GIFSICLE_VERSION}.tar.gz \
    && tar -xvf gifsicle-${GIFSICLE_VERSION}.tar.gz \
    && cd gifsicle-${GIFSICLE_VERSION} \
    && ./configure \
    && make install \
    && cd .. \
    && rm -rf gifsicle-${GIFSICLE_VERSION} gifsicle-${GIFSICLE_VERSION}.tar.gz

COPY . .

RUN apt-get install -y imagemagick \
    && pnpm install \
    && ./node_modules/.bin/tsc

STOPSIGNAL SIGINT

CMD [ "node", "./dist/app.js" ]