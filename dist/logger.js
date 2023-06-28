"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var console_1 = __importDefault(require("console"));
var chalk_1 = __importDefault(require("chalk"));
var fs_1 = __importDefault(require("fs"));
var os_1 = __importDefault(require("os"));
if (!fs_1.default.existsSync("./logs"))
    fs_1.default.mkdirSync("./logs");
var logName = "./logs/log-".concat(new Date().toLocaleDateString().replace(/\//g, "-"), ".txt");
var log = fs_1.default.createWriteStream(logName, { flags: 'a' });
var Log = /** @class */ (function () {
    function Log() {
        // The logo printed to the console. Double backslashes are used to escape the backslashes in the string. Thats why it looks so weird here.
        console_1.default.log(chalk_1.default.cyan(" ___  __     ________   ________   ___   _________     ___    ___    ___    ___  ___    ___  ________   "));
        console_1.default.log(chalk_1.default.cyan("|\\  \\|\\  \\  |\\   __  \\ |\\   ____\\ |\\  \\ |\\___   ___\\  |\\  \\  /  /|  |\\  \\  /  /||\\  \\  /  /||\\_____  \\  "));
        console_1.default.log(chalk_1.default.cyan("\\ \\  \\/  /|_\\ \\  \\|\\  \\\\ \\  \\___| \\ \\  \\\\|___ \\  \\_|  \\ \\  \\/  / /  \\ \\  \\/  / /\\ \\  \\/  / / \\|___/  /| "));
        console_1.default.log(chalk_1.default.cyan(" \\ \\   ___  \\\\ \\  \\\\\\  \\\\ \\  \\     \\ \\  \\    \\ \\  \\    \\ \\    / /    \\ \\    / /  \\ \\    / /      /  / / "));
        console_1.default.log(chalk_1.default.cyan("  \\ \\  \\\\ \\  \\\\ \\  \\\\\\  \\\\ \\  \\____ \\ \\  \\    \\ \\  \\    \\/  /  /___   /     \\/    \\/  /  /      /  /_/__ "));
        console_1.default.log(chalk_1.default.cyan("   \\ \\__\\\\ \\__\\\\ \\_______\\\\ \\_______\\\\ \\__\\    \\ \\__\\ __/  / / |\\__\\ /  /\\   \\  __/  / /       |\\________\\\\"));
        console_1.default.log(chalk_1.default.cyan("    \\|__| \\|__| \\|_______| \\|_______| \\|__|     \\|__||\\___/ /  \\|__|/__/ /\\ __\\|\\___/ /         \\|_______|"));
        console_1.default.log(chalk_1.default.cyan("                                                     \\|___|/        |__|/ \\|__|\\|___|/                     "));
        // Print some information about the server to the console and the log file.
        console_1.default.log(chalk_1.default.blueBright("-------------------------------------------------------"));
        console_1.default.log(chalk_1.default.bgBlue("KoCity Proxy"));
        console_1.default.log(chalk_1.default.blueBright("Version: " + require('../package.json').version));
        console_1.default.log(chalk_1.default.blueBright("Author: " + require('../package.json').author.name));
        console_1.default.log(chalk_1.default.blueBright("Node Version: " + process.version));
        console_1.default.log(chalk_1.default.blueBright("OS: " + os_1.default.platform() + " " + os_1.default.release()));
        console_1.default.log(chalk_1.default.blueBright("-------------------------------------------------------"));
    }
    Log.prototype.info = function (message) {
        process.stdout.write(chalk_1.default.blue("[".concat(new Date().toLocaleString(), "] [INFO] ").concat(message, " \n")));
        log.write("[".concat(new Date().toLocaleString(), "] [INFO] ").concat(message, " \n"));
    };
    Log.prototype.warn = function (message) {
        process.stdout.write(chalk_1.default.yellow("[".concat(new Date().toLocaleString(), "] [WARN] ").concat(message, " \n")));
        log.write("[".concat(new Date().toLocaleString(), "] [WARN] ").concat(message, " \n"));
    };
    Log.prototype.err = function (message) {
        process.stdout.write(chalk_1.default.red("[".concat(new Date().toLocaleString(), "] [ERROR] ").concat(message, " \n")));
        log.write("[".concat(new Date().toLocaleString(), "] ").concat(message, " \n"));
    };
    Log.prototype.debug = function (message) {
        process.stdout.write(chalk_1.default.green("[".concat(new Date().toLocaleString(), "] [DEBUG] ").concat(message, " \n")));
        log.write("[".concat(new Date().toLocaleString(), "] ").concat(message, " \n"));
    };
    Log.prototype.fatal = function (message) {
        process.stdout.write(chalk_1.default.bgRed.white("[".concat(new Date().toLocaleString(), "] [FATAL] ").concat(message, " \n")));
        log.write("[".concat(new Date().toLocaleString(), "] ").concat(message, " \n"));
    };
    return Log;
}());
exports.default = Log;
log.write("KoCity Proxy\n");
log.write("============\n");
log.write("Version: " + require('../package.json').version + "\n");
log.write("Author: " + require('../package.json').author.name + "\n");
log.write("Node Version: " + process.version + "\n");
log.write("OS: " + os_1.default.platform() + " " + os_1.default.release() + "\n");
log.write("============\n");
