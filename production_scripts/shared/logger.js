const fs = require('fs');
const path = require('path');

class Logger {
    constructor(moduleName = 'vapi') {
        this.moduleName = moduleName;
        this.logsDir = path.join(process.cwd(), 'logs');
        this.errorsDir = path.join(this.logsDir, 'errors');
        this.ensureDirectories();
    }

    ensureDirectories() {
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
        if (!fs.existsSync(this.errorsDir)) {
            fs.mkdirSync(this.errorsDir, { recursive: true });
        }
    }

    getDateString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    getLogFilePath() {
        return path.join(this.logsDir, `${this.getDateString()}.log`);
    }

    getErrorLogFilePath() {
        return path.join(this.errorsDir, `${this.getDateString()}.log`);
    }

    formatLogEntry(level, message, data = {}) {
        return {
            timestamp: new Date().toISOString(),
            module: this.moduleName,
            level: level.toUpperCase(),
            message,
            ...data
        };
    }

    writeLog(level, message, data = {}) {
        const logEntry = this.formatLogEntry(level, message, data);
        const logLine = JSON.stringify(logEntry) + '\n';

        fs.appendFileSync(this.getLogFilePath(), logLine, 'utf8');

        if (level.toUpperCase() === 'ERROR') {
            fs.appendFileSync(this.getErrorLogFilePath(), logLine, 'utf8');
        }

        if (process.env.DEBUG === 'true' || level.toUpperCase() === 'ERROR') {
            console.log(logLine.trim());
        }
    }

    info(message, data = {}) {
        this.writeLog('INFO', message, data);
    }

    error(message, errorObj = null) {
        const data = {};
        if (errorObj) {
            if (errorObj instanceof Error) {
                data.error_type = errorObj.name;
                data.error_message = errorObj.message;
                data.stack = errorObj.stack;
            } else if (typeof errorObj === 'object') {
                data.error = errorObj;
            } else {
                data.error = String(errorObj);
            }
        }
        this.writeLog('ERROR', message, data);
    }

    warn(message, data = {}) {
        this.writeLog('WARN', message, data);
    }

    debug(message, data = {}) {
        if (process.env.DEBUG === 'true') {
            this.writeLog('DEBUG', message, data);
        }
    }
}

function createLogger(moduleName) {
    return new Logger(moduleName);
}

const defaultLogger = new Logger('vapi');

module.exports = {
    Logger,
    createLogger,
    logger: defaultLogger,
    info: defaultLogger.info.bind(defaultLogger),
    error: defaultLogger.error.bind(defaultLogger),
    warn: defaultLogger.warn.bind(defaultLogger),
    debug: defaultLogger.debug.bind(defaultLogger)
};
