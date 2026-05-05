import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import type { Logger } from '../logging/logger.js';

export type EmbeddedServerState =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'running'; url: string }
  | { kind: 'error'; message: string };

export type EmbeddedServerController = {
  start(): Promise<string>; // returns the URL once running
  stop(): Promise<void>;
  url(): string | null; // null if not running
  state(): EmbeddedServerState;
};

/**
 * Singleton-only for v1. Creates an isolated dirty.db settings file under
 * userData/embedded-etherpad/ and spawns `npx etherpad-lite@latest` against
 * it on a random localhost port.
 *
 * Pure function shape — accepts a `spawnFn` and `findFreePortFn` injection
 * so tests can substitute fakes without mocking node:child_process.
 */
export function createEmbeddedServer(opts: {
  log: Logger;
  userDataDir: string;
  spawnFn?: typeof spawn;
  findFreePortFn?: () => Promise<number>;
}): EmbeddedServerController {
  let proc: ChildProcess | null = null;
  let s: EmbeddedServerState = { kind: 'idle' };
  let serverUrl: string | null = null;
  // Promise that resolves once state is no longer 'starting'
  let startingPromise: Promise<void> | null = null;

  const dataDir = join(opts.userDataDir, 'embedded-etherpad');
  const settingsPath = join(dataDir, 'settings.json');
  const dbPath = join(dataDir, 'dirty.db');

  const spawnImpl = opts.spawnFn ?? spawn;
  const findPort = opts.findFreePortFn ?? findFreePort;

  async function start(): Promise<string> {
    if (s.kind === 'running') return s.url;
    if (s.kind === 'starting') {
      // Wait for the in-flight start to finish.
      if (startingPromise) await startingPromise;
      // After startingPromise resolves, s will be 'running' or 'error'.
      // serverUrl is set before the state transitions to 'running'.
      if (serverUrl !== null) return serverUrl;
      throw new Error('embedded server failed to start');
    }

    s = { kind: 'starting' };

    let resolveStarting!: () => void;
    startingPromise = new Promise<void>((r) => { resolveStarting = r; });

    // Keep the last 8KB of stderr in memory so a startup failure can be
    // surfaced to the user (the dialog used to hang silently for 240s on
    // any failure — npx 404, port collision, missing system deps, etc.).
    const stderrTailLimit = 8192;
    let stderrTail = '';
    let exitedEarly: { code: number | null; signal: NodeJS.Signals | null } | null = null;

    try {
      mkdirSync(dataDir, { recursive: true });
      const logsDir = join(opts.userDataDir, 'logs');
      mkdirSync(logsDir, { recursive: true });
      const port = await findPort();
      const settings = {
        title: 'Etherpad (embedded)',
        ip: '127.0.0.1',
        port,
        showSettingsInAdminPage: false,
        minify: false,
        requireAuthentication: false,
        requireAuthorization: false,
        users: {},
        dbType: 'dirty',
        dbSettings: { filename: dbPath },
        suppressErrorsInPadText: false,
        trustProxy: false,
        socketTransportProtocols: ['websocket', 'polling'],
        loglevel: 'WARN',
      };
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

      // Always tee stdout+stderr to userData/logs/embedded-etherpad.log so
      // users can see what's happening on a hang. Previously this was gated
      // on EPD_LOG_EMBEDDED which nobody knew to set.
      const logPath = join(logsDir, 'embedded-etherpad.log');
      const logStream = createWriteStream(logPath, { flags: 'a' });
      logStream.write(`\n--- embedded etherpad start @ ${new Date().toISOString()} (port ${port}) ---\n`);
      opts.log.info('starting embedded etherpad', { port, logPath });

      proc = spawnImpl(
        'npx',
        ['--yes', 'etherpad-lite@latest', '--settings', settingsPath],
        {
          cwd: dataDir,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, NODE_ENV: 'production' },
        },
      );
      proc.stdout?.on('data', (b: Buffer) => { logStream.write(b); });
      proc.stderr?.on('data', (b: Buffer) => {
        logStream.write(b);
        const chunk = b.toString();
        stderrTail = (stderrTail + chunk).slice(-stderrTailLimit);
        if (process.env.EPD_LOG_EMBEDDED) process.stderr.write(`[embedded] ${chunk}`);
      });
      proc.on('exit', (code, signal) => {
        opts.log.warn('embedded etherpad exited', { code, signal });
        logStream.end(`--- exited code=${code} signal=${signal} ---\n`);
        if (s.kind === 'starting') {
          // Exit before readiness — record so waitForReachable can fail fast
          // instead of polling for the full timeout.
          exitedEarly = { code, signal };
        }
        proc = null;
        if (s.kind !== 'idle') {
          s = { kind: 'error', message: `Etherpad exited with code ${code ?? 'null'}` };
        }
      });

      const url = `http://127.0.0.1:${port}`;
      // 8 minutes: cold-start `npx etherpad-lite@latest` downloads a multi-
      // hundred-MB tarball before the server even begins booting. 240s was
      // not enough on slower connections — users saw the "Starting…" dialog
      // hang and gave up.
      await waitForReachable(url, 480_000, () => exitedEarly, () => stderrTail);
      serverUrl = url;
      s = { kind: 'running', url };
      return url;
    } catch (e) {
      const message = (e as Error).message;
      s = { kind: 'error', message };
      try {
        proc?.kill('SIGTERM');
      } catch {
        // ignore
      }
      proc = null;
      throw e;
    } finally {
      resolveStarting();
      startingPromise = null;
    }
  }

  async function stop(): Promise<void> {
    if (!proc) {
      s = { kind: 'idle' };
      serverUrl = null;
      return;
    }
    proc.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
    if (proc && !proc.killed) {
      proc.kill('SIGKILL');
    }
    proc = null;
    serverUrl = null;
    s = { kind: 'idle' };
  }

  return {
    start,
    stop,
    url: () => serverUrl,
    state: () => s,
  };
}

async function waitForReachable(
  url: string,
  timeoutMs: number,
  getExitedEarly: () => { code: number | null; signal: NodeJS.Signals | null } | null = () => null,
  getStderrTail: () => string = () => '',
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // Fail fast if the child process already died — no point polling 240s
    // for a server that isn't going to start.
    const exit = getExitedEarly();
    if (exit) {
      const tail = getStderrTail().trim();
      const tailMsg = tail ? `\n--- stderr tail ---\n${tail}` : '';
      throw new Error(
        `embedded etherpad exited before becoming reachable (code=${exit.code ?? 'null'}, signal=${exit.signal ?? 'null'}).${tailMsg}`,
      );
    }
    try {
      const r = await fetch(`${url}/api/`);
      if (r.ok) {
        const text = await r.text();
        if (text.includes('currentVersion')) return;
      }
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  const tail = getStderrTail().trim();
  const tailMsg = tail ? `\n--- stderr tail ---\n${tail}` : '';
  throw new Error(`embedded etherpad did not come up at ${url} within ${timeoutMs}ms.${tailMsg}`);
}

async function findFreePort(): Promise<number> {
  const net = await import('node:net');
  return await new Promise<number>((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (typeof addr === 'object' && addr) {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error('failed to allocate port')));
      }
    });
    srv.on('error', reject);
  });
}
