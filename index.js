const axios = require('axios')
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const config = require('./config');
const chalk = require('chalk');
const fs = require('fs');
const os = require('os');

if(!fs.existsSync("./logs")) fs.mkdirSync("./logs");

// log that individual logs
console.log(chalk.cyan(` ___  __     ________   ________   ___   _________     ___    ___    ___    ___  ___    ___  ________   `));
console.log(chalk.cyan(`|\\  \\|\\  \\  |\\   __  \\ |\\   ____\\ |\\  \\ |\\___   ___\\  |\\  \\  /  /|  |\\  \\  /  /||\\  \\  /  /||\\_____  \\  `));
console.log(chalk.cyan(`\\ \\  \\/  /|_\\ \\  \\|\\  \\\\ \\  \\___| \\ \\  \\\\|___ \\  \\_|  \\ \\  \\/  / /  \\ \\  \\/  / /\\ \\  \\/  / / \\|___/  /| `));
console.log(chalk.cyan(` \\ \\   ___  \\\\ \\  \\\\\\  \\\\ \\  \\     \\ \\  \\    \\ \\  \\    \\ \\    / /    \\ \\    / /  \\ \\    / /      /  / / `));
console.log(chalk.cyan(`  \\ \\  \\\\ \\  \\\\ \\  \\\\\\  \\\\ \\  \\____ \\ \\  \\    \\ \\  \\    \\/  /  /___   /     \\/    \\/  /  /      /  /_/__ `));
console.log(chalk.cyan(`   \\ \\__\\\\ \\__\\\\ \\_______\\\\ \\_______\\\\ \\__\\    \\ \\__\\ __/  / / |\\__\\ /  /\\   \\  __/  / /       |\\________\\\\`));
console.log(chalk.cyan(`    \\|__| \\|__| \\|_______| \\|_______| \\|__|     \\|__||\\___/ /  \\|__|/__/ /\\ __\\|\\___/ /         \\|_______|`));
console.log(chalk.cyan(`                                                     \\|___|/        |__|/ \\|__|\\|___|/                     `));


console.log(chalk.blueBright("-------------------------------------------------------"));
console.log(chalk.bgBlue("KoCity Proxy"));
console.log(chalk.blueBright("Version: " + require('./package.json').version));
console.log(chalk.blueBright("Author: " + require('./package.json').author.name));
console.log(chalk.blueBright("Node Version: " + process.version));
console.log(chalk.blueBright("OS: " + os.platform() + " " + os.release()));
console.log(chalk.blueBright("-------------------------------------------------------"));

require('./logger.js');

if(config.name == "ServerName") console.log.warn("Please change the name in the config.json or via the environment (SERVER_NAME)");

const app = express();

app.use(express.json());

app.get('/stats/status', async (req, res) => {
    console.log.info(`Status requested by ${req.ip}`);

    res.send({
        status: "OK",
        version: require('./package.json').version,
        uptime: process.uptime(),
        connections: await new Promise((resolve, reject) => {
            server.getConnections((err, connections) => {
                if(err) return reject(err);
                resolve(connections-1);
            });
        }),
        maxConnections: config.maxPlayers,
    });
});

app.use(async (req, res, next) => {
    console.log.info(`Request from ${req.ip} to ${req.url}`);
    res.set('X-Powered-By', 'KoCity Proxy');

    if(!req.body.credentials) {
        console.log.info("No credentials");
        return next();
    }

    const authkey = req.body.credentials.username

    if(!authkey) {
        console.log.info("Invalid credentials");
        return res.status(401).send("Invalid credentials");
    }

    let response = await axios.post('http://localhost:23501/auth/validate', {
        authkey,
        server: config.publicAddr
    }).catch((err) => {
        res.status(401).send("Unauthorized");
        if(err.response) console.log.err(`${err.response.data.type} ${err.response.data.message}`);
        else console.log.err(err);
        return "Unauthorized";
    });

    if(response == "Unauthorized") return console.log.info("Request denied");

    if(!response.data.username) {
        console.log.info("Request denied");
        return res.status(401).send("Unauthorized");
    }

    console.log.info(`Request accepted for ${response.data.username}`);

    req.body.credentials.username = response.data.username;

    req.headers['content-length'] = Buffer.byteLength(JSON.stringify(req.body));

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
    console.log.info(`Listening on port ${config.external.port}`);
});


process.on('uncaughtException', function (err) {
    console.log.fatal(err.message);
    console.log.fatal(err.stack);
});

process.on('unhandledRejection', function (err) {
    console.log.fatal(err.message);
    console.log.fatal(err.stack);
});