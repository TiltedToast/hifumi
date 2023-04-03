FROM node:18.14.0
WORKDIR /hifumi
ENV DOCKER=true
COPY package.json .
RUN npm install -g pnpm
RUN pnpm install
COPY . .
STOPSIGNAL SIGINT
CMD [ "pnpm", "run", "docker-build" ]