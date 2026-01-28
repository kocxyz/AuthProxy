FROM node:lts-alpine

WORKDIR /opt/proxy

COPY . .
RUN apk add python3 openssl && npm install

ENTRYPOINT [ "npm", "start" ]
