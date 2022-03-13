FROM node:16.14.0
WORKDIR /hifumi
COPY package*.json ./
RUN npm install && npm install -g typescript 
COPY . .
STOPSIGNAL SIGINT
CMD [ "npm", "run", "docker-build" ]