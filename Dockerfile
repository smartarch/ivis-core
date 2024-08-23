FROM node:20

# install git
RUN apt-get update && apt-get install -y git && apt-get clean;

WORKDIR /app

COPY . .
COPY ./server/config ./config

# install Node modules
RUN cd server && npm install --loglevel silly
RUN cd client && npm install --loglevel silly
RUN cd shared && npm install --loglevel silly

# build the client
RUN cd client && npm run build

# script for waiting for other services to start up
COPY wait-for-it.sh /usr/local/bin/wait-for-it.sh
RUN chmod +x /usr/local/bin/wait-for-it.sh

EXPOSE 8443 8444 8445
