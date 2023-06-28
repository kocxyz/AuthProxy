FROM node:lts-alpine

WORKDIR /opt/proxy

COPY . .
RUN npm install

ENTRYPOINT [ "npm", "start" ]
