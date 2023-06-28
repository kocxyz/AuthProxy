import console from 'console';
import chalk from 'chalk';
import fs from 'fs';
import os from 'os';

const logName = `./logs/log-${new Date().toLocaleDateString().replace(/\//g, "-")}.txt`;
const log = fs.createWriteStream(logName, { flags: 'a' });

export default class Log {
    info(message: string) {
        process.stdout.write(chalk.blue(`[${new Date().toLocaleString()}] [INFO] ${message} \n`));
        log.write(`[${new Date().toLocaleString()}] [INFO] ${message} \n`);
    }

    warn(message: string) {
        process.stdout.write(chalk.yellow(`[${new Date().toLocaleString()}] [WARN] ${message} \n`));
        log.write(`[${new Date().toLocaleString()}] [WARN] ${message} \n`);
    }

    err(message: string) {
        process.stdout.write(chalk.red(`[${new Date().toLocaleString()}] [ERROR] ${message} \n`));
        log.write(`[${new Date().toLocaleString()}] ${message} \n`);
    }

    debug(message: string) {
        process.stdout.write(chalk.green(`[${new Date().toLocaleString()}] [DEBUG] ${message} \n`));
        log.write(`[${new Date().toLocaleString()}] ${message} \n`);
    }

    fatal(message: string) {
        process.stdout.write(chalk.bgRed.white(`[${new Date().toLocaleString()}] [FATAL] ${message} \n`));
        log.write(`[${new Date().toLocaleString()}] ${message} \n`);
    }
}

log.write("KoCity Proxy\n");
log.write("============\n");
log.write("Version: " + require('../package.json').version + "\n");
log.write("Author: " + require('../package.json').author.name + "\n");
log.write("Node Version: " + process.version + "\n");
log.write("OS: " + os.platform() + " " + os.release() + "\n");
log.write("============\n");