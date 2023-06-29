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

RUN apt-get install -y imagemagick \
    && pnpm install

COPY . .

STOPSIGNAL SIGINT

CMD [ "pnpm", "run", "docker-build" ]