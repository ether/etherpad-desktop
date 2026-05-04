// redactForLog is a pure function with no Electron dependencies — safe to import in tests.
// electron-log is loaded lazily inside configureLogging / getLogger so that unit tests
// running under Vitest (node environment, no Electron) can import this module without error.

const REDACTED_KEYS = new Set([
  'padname',
  'serverurl',
  'password',
  'authorization',
  'cookie',
  'set-cookie',
  'title',
]);

export function redactForLog(value: unknown): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redactForLog);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(k.toLowerCase())) {
      out[k] = '[redacted]';
    } else {
      out[k] = redactForLog(v);
    }
  }
  return out;
}

export type Logger = {
  info: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
  debug: (msg: string, ...args: unknown[]) => void;
};

export async function configureLogging(logsDir: string): Promise<void> {
  const log = (await import('electron-log/main')).default;
  log.transports.file.resolvePathFn = () => `${logsDir}/main.log`;
  log.transports.file.maxSize = 5 * 1024 * 1024;
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
  log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
  log.transports.file.level = 'info';
  if (process.env.ELECTRON_DEBUG === '1') {
    log.transports.file.level = 'debug';
    log.transports.console.level = 'debug';
  }
}

export async function getLogger(scope: string): Promise<Logger> {
  const log = (await import('electron-log/main')).default;
  const scoped = log.scope(scope);
  return {
    info: (m, ...a) => scoped.info(m, ...a.map(redactForLog)),
    warn: (m, ...a) => scoped.warn(m, ...a.map(redactForLog)),
    error: (m, ...a) => scoped.error(m, ...a.map(redactForLog)),
    debug: (m, ...a) => scoped.debug(m, ...a.map(redactForLog)),
  };
}
