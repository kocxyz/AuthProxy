const config = require("./config.json");

module.exports = {
  name: process.env.SERVER_NAME || config.name,
  publicAddr: process.env.PUBLIC_ADDRESS || config.publicAddr,
  maxPlayers: process.env.MAX_PLAYERS || config.maxPlayers,
  external: {
    port: process.env.EXTERNAL_PORT || config.external.port,
  },
  internal: {
    port: process.env.INTERNAL_PORT || config.internal.port,
  },
};