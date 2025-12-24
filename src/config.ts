import fs from "fs";

const configFile = JSON.parse(fs.readFileSync("./config.json", "utf8"));

const maxPlayers = process.env.MAX_PLAYERS || configFile.maxPlayers

export default {
  name: process.env.SERVER_NAME || configFile.name,
  authServer: process.env.AUTH_SERVER || configFile.authServer,
  publicAddr: process.env.PUBLIC_ADDRESS || configFile.publicAddr,
  maxPlayers: typeof maxPlayers != "number" ? parseInt(maxPlayers) : maxPlayers,
  external: {
    port: process.env.EXTERNAL_PORT || configFile.external.port,
  },
  internal: {
    host: process.env.INTERNAL_HOST || configFile.internal.host,
    port: process.env.INTERNAL_PORT || configFile.internal.port,
  },
  redis: {
    host: process.env.REDIS_HOST || configFile.redis.host,
    port: process.env.REDIS_PORT || configFile.redis.port,
    password: process.env.REDIS_PASSWORD || configFile.redis.password || undefined,
  },
  postgres: process.env.DATABASE_URL || configFile.postgres,
  
  // Stats Watcher - monitors game database for match completions
  statsWatcher: {
    enabled: process.env.STATS_WATCHER_ENABLED === 'true' || configFile.statsWatcher?.enabled || false,
    gameDbUrl: process.env.GAME_DB_URL || configFile.statsWatcher?.gameDbUrl || 'postgres://viper:viper@127.0.0.1:5434/viper',
    pollIntervalMs: parseInt(process.env.STATS_WATCHER_POLL_INTERVAL || configFile.statsWatcher?.pollIntervalMs || '5000'),
  },
  
  // Trophy Platform webhook - for achievement tracking and sponsorships
  trophy: {
    enabled: process.env.TROPHY_ENABLED === 'true' || configFile.trophy?.enabled || false,
    url: process.env.TROPHY_URL || configFile.trophy?.url || '',
    secret: process.env.TROPHY_SECRET || configFile.trophy?.secret || '',
    gameSlug: process.env.TROPHY_GAME_SLUG || configFile.trophy?.gameSlug || 'knockout-city',
  },
  
  // MetArena webhook - for tournament bracket updates
  metarena: {
    enabled: process.env.METARENA_ENABLED === 'true' || configFile.metarena?.enabled || false,
    url: process.env.METARENA_URL || configFile.metarena?.url || '',
    secret: process.env.METARENA_SECRET || configFile.metarena?.secret || '',
    serverId: process.env.METARENA_SERVER_ID || configFile.metarena?.serverId || '',
    serverName: process.env.SERVER_NAME || configFile.name || 'KOCity Server',
  }
}
