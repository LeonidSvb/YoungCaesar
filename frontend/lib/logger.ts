import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, `frontend-${new Date().toISOString().split('T')[0]}.log`);

// Убедимся что директория существует
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG';
  message: string;
  data?: unknown;
}

function writeLog(entry: LogEntry) {
  const logLine = `[${entry.timestamp}] [${entry.level}] ${entry.message}${
    entry.data ? ` | ${JSON.stringify(entry.data)}` : ''
  }\n`;

  try {
    fs.appendFileSync(LOG_FILE, logLine, 'utf8');
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

export const logger = {
  info: (message: string, data?: unknown) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      data,
    };
    console.log(`[INFO] ${message}`, data || '');
    writeLog(entry);
  },

  error: (message: string, data?: unknown) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      data,
    };
    console.error(`[ERROR] ${message}`, data || '');
    writeLog(entry);
  },

  warn: (message: string, data?: unknown) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message,
      data,
    };
    console.warn(`[WARN] ${message}`, data || '');
    writeLog(entry);
  },

  debug: (message: string, data?: unknown) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'DEBUG',
      message,
      data,
    };
    console.debug(`[DEBUG] ${message}`, data || '');
    writeLog(entry);
  },

  api: (method: string, path: string, status: number, duration?: number, data?: unknown) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: `API ${method} ${path} - ${status}${duration ? ` (${duration}ms)` : ''}`,
      data,
    };
    console.log(entry.message, data || '');
    writeLog(entry);
  },
};
