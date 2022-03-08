FROM node:17
WORKDIR /hifumi
COPY package*.json ./
RUN npm install && npm install -g typescript 
COPY . .
STOPSIGNAL SIGINT
CMD [ "npm", "run", "docker-build" ]