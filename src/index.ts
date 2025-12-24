import axios from 'axios';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import config from './config';
import { createClient } from 'redis';
import { PrismaClient } from '@prisma/client'

import Logger from './logger.js'

import { StatsWatcher } from './stats-watcher';
import { TrophyWebhook } from './webhooks-trophy';
import { MetArenaWebhook } from './webhooks-metarena';
import { authError, authResponse, authErrorData } from './interfaces'

const log = new Logger();

if (config.name == "ServerName") log.warn("Please change the name in the config.json or via the environment (SERVER_NAME)");

const redis = createClient({
    socket: {
        host: config.redis.host,
        port: config.redis.port,
    },
    password: config.redis.password,
});
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: config.postgres,
        }
    }
});

redis.connect().then(() => {
    log.info("Connected to Redis");
}).catch((err: any) => {
    log.fatal("Failed to connect to Redis");
    log.fatal(err.message);
    log.fatal(err.stack ? err.stack.toString() : '');
    process.exit(1);
});
prisma.$connect().then(() => {
    log.info("Connected to Postgres");
}).catch((err: any) => {
    log.fatal("Failed to connect to Postgres");
    log.fatal(err.message);
    log.fatal(err.stack ? err.stack.toString() : '');
    process.exit(1);
});
// Initialize webhooks (if enabled in config)
const trophyWebhook = config.trophy.enabled ? new TrophyWebhook(config.trophy) : null;
const metarenaWebhook = config.metarena.enabled ? new MetArenaWebhook(config.metarena) : null;

// Initialize and start Stats Watcher (if enabled in config)
const statsWatcher = new StatsWatcher(config.statsWatcher, trophyWebhook, metarenaWebhook);
setTimeout(() => {
    statsWatcher.start().catch(err => {
        log.err(`Failed to start stats watcher: ${err.message}`);
    });
}, 2000);

const app = express();

app.use(express.json());

app.get('/stats/status', async (req, res) => {
    res.send({
        status: "OK",
        version: require('../package.json').version,
        uptime: process.uptime(),
        connections: (await redis.KEYS('user:session:*')).length,
        maxConnections: config.maxPlayers,
    });
});

app.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    log.info(`Request from ${req.ip} to ${req.url}`);
    res.set('X-Powered-By', 'KoCity Proxy');

    if (!req.body.credentials) {
        log.info("No credentials");
        return next();
    }

    const authkey = req.body.credentials.username

    if (!authkey) {
        log.info("Invalid credentials");
        return res.status(401).send("Invalid credentials");
    }

    const response: null | authResponse = await axios.post(`${config.authServer}/auth/validate`, {
        authkey,
        server: config.publicAddr
    }).catch((err: authError): null => {
        res.status(401).send("Unauthorized");
        if (err.response) log.err(`${(err.response.data as authErrorData).type} ${(err.response.data as authErrorData).message}`);
        else log.err(err.message);
        return null;
    });

    if (!response) return log.info("Request denied");

    if (!response.data?.username) {
        log.info("Request denied");
        return res.status(401).send("Unauthorized");
    }

    if (!response.data.velanID) {
        let localUser = await prisma.users.findFirst({
            where: {
                username: response.data.username,
            }
        });

        let velanID: number | undefined;
        if (!localUser) {
            const createdUser = await axios.post(`http://${config.internal.host}:${config.internal.port}/api/auth`, {
                credentials: {
                    username: response.data.username,
                    platform: "win64",
                    pid: 0,
                    system_guid: "0",
                    version: 269701,
                    build: "final",
                    boot_session_guid: "0",
                    is_using_epic_launcher: false
                },
                auth_provider: "dev"
            })

            velanID = createdUser.data.user.id.velan
        } else velanID = Number(localUser.id)

        const saved = await axios.post(`${config.authServer}/auth/connect`, {
            authkey,
            server: config.publicAddr,
            velanID
        }).catch((err: authError): null => {
            res.status(401).send("Unauthorized");
            if (err.response) log.err(`${(err.response.data as authErrorData).type} ${(err.response.data as authErrorData).message}`);
            else log.err(err.message);
            return null;
        });
        if (!saved) return log.info("Request denied");

        response.data.velanID = velanID;
    }
    if (!response.data.velanID) return log.info("Request denied");

    await prisma.users.update({
        where: {
            id: Number(response.data.velanID)
        },
        data: {
            username: `${response.data.color ? `:${response.data.color}FF:` : ''}${response.data.username}`
        }
    })

    log.info(`Request accepted for ${response.data.username}`);

    req.body.credentials.username = `${response.data.color ? `:${response.data.color}FF:` : ''}${response.data.username}`
    req.body.auth_provider = 'dev'
    req.headers['content-length'] = Buffer.byteLength(JSON.stringify(req.body)).toString();
    next();
})

const proxy = createProxyMiddleware({
    target: `http://${config.internal.host}:${config.internal.port}`,
    changeOrigin: true,
    ws: true,
    onProxyReq: (proxyReq, req, res, options) => {
        if (req.url.includes('status')) return;
        proxyReq.end(JSON.stringify(req.body));
    }
})

app.all('*', proxy)

const server = app.listen(config.external.port, () => {
    log.info(`Listening on port ${config.external.port}`);
});


process.on('uncaughtException', function (err: Error) {
    log.fatal(err.message);
    log.fatal(err.stack ? err.stack.toString() : '');
});

process.on('unhandledRejection', function (err: Error) {
    log.fatal(err.message);
    log.fatal(err.stack ? err.stack.toString() : '');
});