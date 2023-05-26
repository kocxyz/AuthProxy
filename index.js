const axios = require('axios')
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

const config = require('./config.json');

app.use(express.json());

app.get('/stats/status', async (req, res) => {
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
    console.log("-------------------------proxyReq-------------------------");

    const credentials = req.body.credentials.username.split("/")

    if(credentials.length != 2) {
        console.log("Invalid credentials");
        return res.status(401).send("Invalid credentials");
    }

    let response = await axios.post('https://api.kocity.xyz/auth/reauth', {
        username: credentials[0],
        authToken: credentials[1],
    }).catch((err) => {
        res.status(401).send("Unauthorized");
        return "Unauthorized";
    });

    if(response == "Unauthorized") return console.log("Unauthorized"), console.log("-------------------------done-------------------------");

    if(!response.data.username) {
        console.log("Username invalid");
        return res.status(401).send("Unauthorized");
    }

    req.body.credentials.username = response.data.username;

    req.headers['content-length'] = Buffer.byteLength(JSON.stringify(req.body));

    next();
    console.log("-------------------------done-------------------------");
  })

const proxy = createProxyMiddleware({
    target: 'http://127.0.0.1:23500',
    changeOrigin: true,
    ws: true,
    onProxyReq: (proxyReq, req, res, options) => {
        if (req.url.includes('status')) return;
        proxyReq.end(JSON.stringify(req.body));
    }
})

app.all('*', proxy)

const server = app.listen(23600);


process.on('uncaughtException', function (err) {
    console.log(err);
});

process.on('unhandledRejection', function (err) {
    console.log(err);
});

(async () => {
    let version = await axios.get('https://raw.githubusercontent.com/5zig/The-5zig-API/master/versions.json')
})();
