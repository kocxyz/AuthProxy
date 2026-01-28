import axios from 'axios';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import config from './config';
import { createClient } from 'redis';
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto';

import Logger from './logger.js'

import { authError, authResponse, authErrorData } from './interfaces'
import { verifyHash } from './zerostatic';

const log = new Logger();

const zeroStaticReportees = new Map<string, {
    username: string,
    token: string,
    reported: boolean,
    used: boolean,
    createdAt: number,
}>();

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

app.get("/stats/preflight", (req, res) => {
    res.send({
        zeroStaticEnabled: config.zerostatic.enabled,
    })
});

app.post("/zerostatic/telem", express.json(), async (req, res) => {
    if (!config.zerostatic.enabled) {
        return res.status(403).send("Zerostatic integration is disabled");
    }

    const { token, username, detection } = req.body;
    if (!token || !username || !detection) return res.status(400).send("Missing parameters");

    const alreadyReported = zeroStaticReportees.get(token);
    if (!alreadyReported || alreadyReported.username !== username) {
        log.info(`Zerostatic telem received for unknown user ${username}`);
        return res.status(400).send("Unknown user");
    }

    if (alreadyReported.reported) {
        log.info(`Zerostatic telem already reported for user ${username}`);
        return res.status(200).send("Already reported");
    }

    // Report to Zerostatic webhook (Discord webhook (make it an embed))
    await axios.post(config.zerostatic.webhookURL, {
        embeds: [{
            title: "Zerostatic Detection Report",
            color: 16711680,
            fields: [
                {
                    name: "Username",
                    value: username,
                    inline: true,
                },
                {
                    name: "Detection",
                    value: detection,
                    inline: true,
                },
                {
                    name: "Token",
                    value: token,
                    inline: false,
                }
            ],
            timestamp: new Date().toISOString(),
        }]
    }).catch((err: any) => {
        log.err(`Failed to report Zerostatic detection for user ${username}: ${err.message}`);
    });

    alreadyReported.reported = true;
    zeroStaticReportees.set(token, alreadyReported);

    log.info(`Zerostatic detection reported for user ${username}: ${detection}`);

    res.status(200).send("Reported");
});

app.post("/zerostatic/init", express.json(), async (req, res) => {
    if (!config.zerostatic.enabled) {
        return res.status(403).send("Zerostatic integration is disabled");
    }

    const { username, authkey, hash } = req.body;
    if (!username || !authkey || !hash) return res.status(400).send("Missing parameters");

    const valid = verifyHash(hash, authkey, username, config.zerostatic.secret);
    if (!valid) {
        log.info(`Invalid Zerostatic hash for user ${username}`);
        return res.status(401).send("Invalid hash");
    }

    log.info(`Zerostatic init received for user ${username}`);

    zeroStaticReportees.set(authkey, {
        username,
        token: authkey,
        reported: false,
        used: false,
        createdAt: Date.now(),
    });
    
    res.status(200).send("Initialized");
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

    if (config.zerostatic.enabled) {
        const zeroStaticData = zeroStaticReportees.get(authkey);
        if (!zeroStaticData) {
            log.info(`Zerostatic data not found for user ${response.data.username}`);
            return res.status(401).send("Unauthorized");
        }

        if (zeroStaticData.used) {
            log.info(`Zerostatic data already used for user ${response.data.username}`);
            return res.status(401).send("Unauthorized");
        }

        zeroStaticData.used = true;
        zeroStaticReportees.set(authkey, zeroStaticData);
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


if (config.zerostatic.enabled) {
    setInterval(() => {
        const now = Date.now();

        zeroStaticReportees.forEach((value, key) => {
            if (now - value.createdAt > 5 * 60 * 1000) {
                zeroStaticReportees.delete(key);
                log.info(`Zerostatic data for user ${value.username} expired and removed`);
            }
        });
    }, 60 * 1000);
}


process.on('uncaughtException', function (err: Error) {
    log.fatal(err.message);
    log.fatal(err.stack ? err.stack.toString() : '');
});

process.on('unhandledRejection', function (err: Error) {
    log.fatal(err.message);
    log.fatal(err.stack ? err.stack.toString() : '');
});