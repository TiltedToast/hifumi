FROM oven/bun:latest AS build

WORKDIR /build
COPY . .

RUN apt update
RUN apt install -y git
RUN apt install -y imagemagick
RUN bun install

ENV GIFSICLE_VERSION 1.94
RUN wget https://www.lcdf.org/gifsicle/gifsicle-${GIFSICLE_VERSION}.tar.gz \
    && tar -xvf gifsicle-${GIFSICLE_VERSION}.tar.gz \
    && cd gifsicle-${GIFSICLE_VERSION} \
    && ./configure \
    && make install -j$(nproc) \
    && cd .. \
    && rm -rf gifsicle-${GIFSICLE_VERSION} gifsicle-${GIFSICLE_VERSION}.tar.gz

FROM oven/bun:latest

WORKDIR /hifumi
ENV DOCKER true

COPY --from=build /build .

STOPSIGNAL SIGINT

CMD [ "bun", "./src/app.ts" ]