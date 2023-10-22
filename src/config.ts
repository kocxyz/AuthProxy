import fs from "fs";

import { config } from "./interfaces"

const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

const maxPlayers = process.env.MAX_PLAYERS || config.maxPlayers

/**
 * This exports a default object that contains the configuration for the server.
 * The object contains the following properties:
 * - name: the name of the server, taken from the environment variable SERVER_NAME or the config file.
 * - authServer: the URL of the authentication server, taken from the environment variable AUTH_SERVER or the config file.
 * - publicAddr: the public address of the server, taken from the environment variable PUBLIC_ADDRESS or the config file.
 * - maxPlayers: the maximum number of players allowed on the server, taken from the environment variable MAX_PLAYERS or the config file.
 * - external: an object containing the following properties:
 *   - port: the port number for external connections, taken from the environment variable EXTERNAL_PORT or the config file.
 * - internal: an object containing the following properties:
 *   - host: the host name for internal connections, taken from the environment variable INTERNAL_HOST or the config file.
 *   - port: the port number for internal connections, taken from the environment variable INTERNAL_PORT or the config file.
 */
export default {
  name: process.env.SERVER_NAME || config.name,
  authServer: process.env.AUTH_SERVER || config.authServer,
  publicAddr: process.env.PUBLIC_ADDRESS || config.publicAddr,
  maxPlayers: typeof maxPlayers != "number" ? parseInt(maxPlayers) : maxPlayers,
  external: {
    port: process.env.EXTERNAL_PORT || config.external.port,
  },
  internal: {
    host: process.env.INTERNAL_HOST || config.internal.host,
    port: process.env.INTERNAL_PORT || config.internal.port,
  },
  redis: {
    host: process.env.REDIS_HOST || config.redis.host,
    port: process.env.REDIS_PORT || config.redis.port,
    password: process.env.REDIS_PASSWORD || config.redis.password || undefined,
  },
  postgres: process.env.DATABASE_URL || config.postgres,
  mod: {
    dirPath: process.env.MOD_DIR_PATH || config.mod.dirPath,
    configDirPath: process.env.MOD_CONFIG_DIR_PATH || config.mod.configDirPath,
  },
} satisfies config