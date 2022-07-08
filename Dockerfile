FROM node:16.14.0
WORKDIR /hifumi
ENV DOCKER=true
COPY package*.json ./
RUN npm install && npm install -g typescript
COPY . .
STOPSIGNAL SIGINT
CMD [ "npm", "run", "docker-build" ]