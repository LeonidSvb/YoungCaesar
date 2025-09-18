#!/usr/bin/env node
/**
 * LOGGER - Standardized Logging Utility
 *
 * PURPOSE: Consistent logging across all modules with timestamps and colors
 * USAGE: const logger = require('./shared/logger');
 * OUTPUT: Formatted console logs with timestamps
 *
 * AUTHOR: VAPI Team
 * CREATED: 2025-09-19
 * VERSION: 1.0.0
 */

/**
 * Simple logger with consistent formatting across modules
 */
class Logger {
    constructor(moduleName = 'VAPI') {
        this.moduleName = moduleName.toUpperCase();
    }

    formatMessage(level, message) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        return `[${timestamp}] [${this.moduleName}] ${level}: ${message}`;
    }

    info(message) {
        console.log(`📊 ${this.formatMessage('INFO', message)}`);
    }

    success(message) {
        console.log(`✅ ${this.formatMessage('SUCCESS', message)}`);
    }

    warning(message) {
        console.log(`⚠️ ${this.formatMessage('WARNING', message)}`);
    }

    error(message) {
        console.error(`❌ ${this.formatMessage('ERROR', message)}`);
    }

    debug(message) {
        if (process.env.DEBUG === 'true') {
            console.log(`🔍 ${this.formatMessage('DEBUG', message)}`);
        }
    }

    progress(message) {
        console.log(`🔄 ${this.formatMessage('PROGRESS', message)}`);
    }

    cost(amount, currency = 'USD') {
        console.log(`💰 ${this.formatMessage('COST', `$${amount.toFixed(4)} ${currency}`)}`);
    }

    timing(duration, unit = 'seconds') {
        console.log(`⏱️ ${this.formatMessage('TIMING', `${duration} ${unit}`)}`);
    }
}

/**
 * Create a logger instance for a specific module
 * @param {string} moduleName - Name of the module using the logger
 * @returns {Logger} - Logger instance
 */
function createLogger(moduleName) {
    return new Logger(moduleName);
}

// Default logger instance
const defaultLogger = new Logger('VAPI');

module.exports = {
    Logger,
    createLogger,
    logger: defaultLogger,
    info: defaultLogger.info.bind(defaultLogger),
    success: defaultLogger.success.bind(defaultLogger),
    warning: defaultLogger.warning.bind(defaultLogger),
    error: defaultLogger.error.bind(defaultLogger),
    debug: defaultLogger.debug.bind(defaultLogger),
    progress: defaultLogger.progress.bind(defaultLogger),
    cost: defaultLogger.cost.bind(defaultLogger),
    timing: defaultLogger.timing.bind(defaultLogger)
};