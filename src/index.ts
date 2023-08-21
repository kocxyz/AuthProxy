import axios from 'axios';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import config from './config';
import { createClient } from 'redis';

import Logger from './logger.js'

import { authError, authResponse, authErrorData } from './interfaces'

const log = new Logger();

if(config.name == "ServerName") log.warn("Please change the name in the config.json or via the environment (SERVER_NAME)");

const redis = createClient({
    socket: {
        host: config.redis.host,
        port: config.redis.port,
    },
    password: config.redis.password,
});

redis.connect().then(() => {
    log.info("Connected to Redis");
}).catch((err) => {
    log.fatal("Failed to connect to Redis");
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

app.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    log.info(`Request from ${req.ip} to ${req.url}`);
    res.set('X-Powered-By', 'KoCity Proxy');

    if(!req.body.credentials) {
        log.info("No credentials");
        return next();
    }

    const authkey = req.body.credentials.username

    if(!authkey) {
        log.info("Invalid credentials");
        return res.status(401).send("Invalid credentials");
    }

    const response: null | authResponse = await axios.post(`${config.authServer}/auth/validate`, {
        authkey,
        server: config.publicAddr
    }).catch((err: authError): null => {
        res.status(401).send("Unauthorized");
        if(err.response) log.err(`${(err.response.data as authErrorData).type} ${(err.response.data as authErrorData).message}`);
        else log.err(err.message);
        return null;
    });

    if(!response) return log.info("Request denied");

    if(!response.data?.username) {
        log.info("Request denied");
        return res.status(401).send("Unauthorized");
    }

    log.info(`Request accepted for ${response.data.username}`);

    req.body.credentials.username = response.data.username;

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