import log from 'electron-log';
import path from 'path';
import { app } from 'electron';

// Configure file output
log.transports.file.resolvePathFn = () => {
  return path.join(app.getPath('userData'), 'logs', 'main.log');
};

// File level
log.transports.file.level = 'debug';
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB

// Console level
log.transports.console.level = 'debug';
log.transports.console.format = '[{h}:{i}:{s}] [{level}] {text}';

// In-memory log buffer for renderer panel
interface LogEntry {
  timestamp: string;
  level: string;
  module: string;
  message: string;
  stack?: string;
}

const logBuffer: LogEntry[] = [];
const MAX_BUFFER = 500;

// Override console methods to capture logs
const originalError = log.error.bind(log);
const originalWarn = log.warn.bind(log);
const originalInfo = log.info.bind(log);
const originalDebug = log.debug.bind(log);

function addToBuffer(entry: LogEntry) {
  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER) {
    logBuffer.shift();
  }
}

function serialize(params: any[]): string {
  return params.map(p => {
    if (p instanceof Error) return p.message;
    if (typeof p === 'object') return JSON.stringify(p);
    return String(p);
  }).join(' ');
}

function extractModule(params: any[]): string {
  for (const p of params) {
    if (typeof p === 'string') {
      const match = p.match(/^\[([^\]]+)\]/);
      if (match) return match[1];
    }
  }
  return 'main';
}

function extractStack(params: any[]): string | undefined {
  for (const p of params) {
    if (p instanceof Error && p.stack) return p.stack;
  }
  return undefined;
}

log.error = function (...params: any[]) {
  addToBuffer({
    timestamp: new Date().toISOString(),
    level: 'error',
    module: extractModule(params),
    message: serialize(params),
    stack: extractStack(params),
  });
  originalError(...params);
};

log.warn = function (...params: any[]) {
  addToBuffer({
    timestamp: new Date().toISOString(),
    level: 'warn',
    module: extractModule(params),
    message: serialize(params),
  });
  originalWarn(...params);
};

log.info = function (...params: any[]) {
  addToBuffer({
    timestamp: new Date().toISOString(),
    level: 'info',
    module: extractModule(params),
    message: serialize(params),
  });
  originalInfo(...params);
};

log.debug = function (...params: any[]) {
  addToBuffer({
    timestamp: new Date().toISOString(),
    level: 'debug',
    module: extractModule(params),
    message: serialize(params),
  });
  originalDebug(...params);
};

// Create a module-scoped logger helper
export function createModuleLogger(moduleName: string) {
  return {
    error: (...params: any[]) => log.error(`[${moduleName}]`, ...params),
    warn: (...params: any[]) => log.warn(`[${moduleName}]`, ...params),
    info: (...params: any[]) => log.info(`[${moduleName}]`, ...params),
    debug: (...params: any[]) => log.debug(`[${moduleName}]`, ...params),
  };
}

// IPC handlers for log viewer
export function registerLogIPC(ipcMain: any) {
  ipcMain.handle('log:getEntries', (_, options?: { level?: string; module?: string; limit?: number }) => {
    let entries = [...logBuffer];
    if (options?.level) {
      entries = entries.filter(e => e.level === options.level);
    }
    if (options?.module) {
      entries = entries.filter(e => e.module === options.module);
    }
    if (options?.limit) {
      entries = entries.slice(-options.limit);
    }
    return entries;
  });

  ipcMain.handle('log:export', () => {
    const logPath = path.join(app.getPath('userData'), 'logs', 'main.log');
    return logPath;
  });

  ipcMain.handle('log:clear', () => {
    logBuffer.length = 0;
    return true;
  });

  ipcMain.handle('log:getBuffer', () => {
    return [...logBuffer].slice(-20);
  });
}

export { log };
