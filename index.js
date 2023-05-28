const axios = require('axios')
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const config = require('./config.json');

if(config.name == "ServerName") console.log("Please change the name in config.json");

const app = express();

app.use(express.json());

app.get('/stats/status', async (req, res) => {
    console.log("-------------------------status-------------------------");
    console.log(`Status requested by ${req.ip}`);

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
    console.log("-------------------------done-------------------------");
});

app.use(async (req, res, next) => {
    console.log("-------------------------proxyReq-------------------------");
    res.set('X-Powered-By', 'KoCity Proxy');

    if(!req.body.credentials) {
        console.log("No credentials");
        return next();
    }

    const authkey = req.body.credentials.username

    if(!authkey) {
        console.log("Invalid credentials");
        return res.status(401).send("Invalid credentials");
    }

    console.log(`Proxy request to ${req.url}`);

    let response = await axios.post('http://localhost:23501/auth/validate', {
        authkey,
        server: config.publicAddr
    }).catch((err) => {
        res.status(401).send("Unauthorized");
        if(err.response) console.log(err.response.data);
        else console.log(err);
        return "Unauthorized";
    });

    if(response == "Unauthorized") return console.log("Unauthorized"), console.log("-------------------------done-------------------------");

    if(!response.data.username) {
        console.log("Username invalid");
        return res.status(401).send("Unauthorized");
    }

    console.log(`Proxying request from ${response.data.username} granted`);

    req.body.credentials.username = response.data.username;

    req.headers['content-length'] = Buffer.byteLength(JSON.stringify(req.body));

    next();
    console.log("-------------------------done-------------------------");
  })

const proxy = createProxyMiddleware({
    target: `http://127.0.0.1:${config.internal.port}`,
    changeOrigin: true,
    ws: true,
    onProxyReq: (proxyReq, req, res, options) => {
        if (req.url.includes('status')) return;
        proxyReq.end(JSON.stringify(req.body));
    }
})

app.all('*', proxy)

const server = app.listen(config.external.port, () => {
    console.log(`Proxy listening on port ${config.external.port}`);
});


process.on('uncaughtException', function (err) {
    console.log(err);
});

process.on('unhandledRejection', function (err) {
    console.log(err);
});