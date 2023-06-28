"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var axios_1 = __importDefault(require("axios"));
var express_1 = __importDefault(require("express"));
var http_proxy_middleware_1 = require("http-proxy-middleware");
var config_1 = __importDefault(require("./config"));
var logger_js_1 = __importDefault(require("./logger.js"));
var log = new logger_js_1.default();
if (config_1.default.name == "ServerName")
    log.warn("Please change the name in the config.json or via the environment (SERVER_NAME)");
var app = (0, express_1.default)();
app.use(express_1.default.json());
app.get('/stats/status', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                log.info("Status requested by ".concat(req.ip));
                _b = (_a = res).send;
                _c = {
                    status: "OK",
                    version: require('../package.json').version,
                    uptime: process.uptime()
                };
                return [4 /*yield*/, new Promise(function (resolve, reject) {
                        server.getConnections(function (err, connections) {
                            if (err)
                                return reject(err);
                            resolve(connections - 1);
                        });
                    })];
            case 1:
                _b.apply(_a, [(_c.connections = _d.sent(),
                        _c.maxConnections = config_1.default.maxPlayers,
                        _c)]);
                return [2 /*return*/];
        }
    });
}); });
app.use(function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var authkey, response;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                log.info("Request from ".concat(req.ip, " to ").concat(req.url));
                res.set('X-Powered-By', 'KoCity Proxy');
                if (!req.body.credentials) {
                    log.info("No credentials");
                    return [2 /*return*/, next()];
                }
                authkey = req.body.credentials.username;
                if (!authkey) {
                    log.info("Invalid credentials");
                    return [2 /*return*/, res.status(401).send("Invalid credentials")];
                }
                return [4 /*yield*/, axios_1.default.post("".concat(config_1.default.authServer, "/auth/validate"), {
                        authkey: authkey,
                        server: config_1.default.publicAddr
                    }).catch(function (err) {
                        res.status(401).send("Unauthorized");
                        if (err.response)
                            log.err("".concat(err.response.data.type, " ").concat(err.response.data.message));
                        else
                            log.err(err.message);
                        return null;
                    })];
            case 1:
                response = _b.sent();
                if (!response)
                    return [2 /*return*/, log.info("Request denied")];
                if (!((_a = response.data) === null || _a === void 0 ? void 0 : _a.username)) {
                    log.info("Request denied");
                    return [2 /*return*/, res.status(401).send("Unauthorized")];
                }
                log.info("Request accepted for ".concat(response.data.username));
                req.body.credentials.username = response.data.username;
                req.headers['content-length'] = Buffer.byteLength(JSON.stringify(req.body)).toString();
                next();
                return [2 /*return*/];
        }
    });
}); });
var proxy = (0, http_proxy_middleware_1.createProxyMiddleware)({
    target: "http://".concat(config_1.default.internal.host, ":").concat(config_1.default.internal.port),
    changeOrigin: true,
    ws: true,
    onProxyReq: function (proxyReq, req, res, options) {
        if (req.url.includes('status'))
            return;
        proxyReq.end(JSON.stringify(req.body));
    }
});
app.all('*', proxy);
var server = app.listen(config_1.default.external.port, function () {
    log.info("Listening on port ".concat(config_1.default.external.port));
});
process.on('uncaughtException', function (err) {
    log.fatal(err.message);
    log.fatal(err.stack ? err.stack.toString() : '');
});
process.on('unhandledRejection', function (err) {
    log.fatal(err.message);
    log.fatal(err.stack ? err.stack.toString() : '');
});
