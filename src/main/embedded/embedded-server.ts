import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
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

    try {
      mkdirSync(dataDir, { recursive: true });
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

      proc = spawnImpl(
        'npx',
        ['--yes', 'etherpad-lite@latest', '--settings', settingsPath],
        {
          cwd: dataDir,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, NODE_ENV: 'production' },
        },
      );
      proc.stderr?.on('data', (b: Buffer) => {
        if (process.env.EPD_LOG_EMBEDDED) process.stderr.write(`[embedded] ${b.toString()}`);
      });
      proc.on('exit', (code) => {
        opts.log.warn('embedded etherpad exited', { code });
        proc = null;
        if (s.kind !== 'idle') {
          s = { kind: 'error', message: `Etherpad exited with code ${code ?? 'null'}` };
        }
      });

      const url = `http://127.0.0.1:${port}`;
      await waitForReachable(url, 240_000);
      serverUrl = url;
      s = { kind: 'running', url };
      return url;
    } catch (e) {
      s = { kind: 'error', message: (e as Error).message };
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

async function waitForReachable(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
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
  throw new Error(`embedded etherpad did not come up at ${url}`);
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
