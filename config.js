const config = require("./config.json");

const maxPlayers = process.env.MAX_PLAYERS || config.maxPlayers

module.exports = {
  name: process.env.SERVER_NAME || config.name,
  publicAddr: process.env.PUBLIC_ADDRESS || config.publicAddr,
  maxPlayers: typeof maxPlayers != "number" ? parseInt(maxPlayers) : maxPlayers,
  external: {
    port: process.env.EXTERNAL_PORT || config.external.port,
  },
  internal: {
    port: process.env.INTERNAL_PORT || config.internal.port,
  },
};
