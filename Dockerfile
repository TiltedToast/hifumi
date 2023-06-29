FROM node:18.16.0
WORKDIR /hifumi
ENV DOCKER=true
COPY package.json .
RUN npm install -g pnpm \
    && pnpm install \
    && apt-get install -y imagemagick

COPY . .
STOPSIGNAL SIGINT

ENV GIFSICLE_VERSION 1.94
RUN wget https://www.lcdf.org/gifsicle/gifsicle-${GIFSICLE_VERSION}.tar.gz \
    && tar -xvf gifsicle-${GIFSICLE_VERSION}.tar.gz \
    && cd gifsicle-${GIFSICLE_VERSION} \
    && ./configure \
    && make install \
    && cd .. \
    && rm -rf gifsicle-${GIFSICLE_VERSION} gifsicle-${GIFSICLE_VERSION}.tar.gz

CMD [ "pnpm", "run", "docker-build" ]