import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
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
 * The path to a Node-runnable executable. In production the Electron
 * binary doubles as Node when `ELECTRON_RUN_AS_NODE=1` is set, which is
 * the canonical way Electron apps ship a Node runtime without bundling
 * a separate copy. Tests inject a plain `node` path.
 */
export interface NodeRuntime {
  execPath: string;
  /** Extra env vars needed (e.g. `ELECTRON_RUN_AS_NODE=1` for Electron). */
  env: Record<string, string>;
}

/** Reasonable default for production Electron apps. */
export const electronAsNode: NodeRuntime = {
  execPath: process.execPath,
  env: { ELECTRON_RUN_AS_NODE: '1' },
};

/**
 * Resolve where the bundled Etherpad source lives. In dev (`pnpm dev`) the
 * fetch script drops it at `packages/desktop/resources/etherpad/`. In a
 * packaged Electron app electron-builder copies the same tree into
 * `<resourcesPath>/etherpad/` via `extraResources`.
 *
 * Returns `null` when neither location has a `src/node/server.ts` — the
 * caller surfaces a friendly error rather than asphyxiating on a spawn
 * failure inside `npx`.
 */
export function findBundledEtherpadDir(opts: { resourcesPath?: string; appRoot?: string }): string | null {
  const candidates: string[] = [];
  // Packaged app: electron-builder extraResources copies to resourcesPath.
  if (opts.resourcesPath) candidates.push(join(opts.resourcesPath, 'etherpad'));
  // Dev/test layouts where main runs from various depths:
  if (opts.appRoot) {
    candidates.push(join(opts.appRoot, 'resources', 'etherpad'));
    // electron-vite's out/main → appRoot may resolve to out/main; resources is at ../../resources
    candidates.push(join(opts.appRoot, '..', '..', 'resources', 'etherpad'));
    candidates.push(join(opts.appRoot, '..', 'resources', 'etherpad'));
  }
  for (const dir of candidates) {
    if (existsSync(join(dir, 'src', 'node', 'server.ts'))) return dir;
  }
  return null;
}

/**
 * Singleton-only for v1. Creates an isolated dirty.db settings file under
 * userData/embedded-etherpad/ and spawns the bundled Etherpad source
 * (`scripts/fetch-etherpad.mjs` is the dev prereq; CI will pre-bundle).
 *
 * Pure function shape — accepts a `spawnFn` and `findFreePortFn` injection
 * so tests can substitute fakes without mocking node:child_process. The
 * `etherpadDir` is also injectable for tests; in production it's resolved
 * via `findBundledEtherpadDir` at call sites.
 */
export function createEmbeddedServer(opts: {
  log: Logger;
  userDataDir: string;
  /** Path containing `src/node/server.ts`. When omitted, `start()` throws. */
  etherpadDir?: string;
  /**
   * Node runtime to spawn (defaults to Electron-as-Node so production
   * doesn't need system node installed). Tests pass `{ execPath: 'node',
   * env: {} }` to keep spawn args simple.
   */
  nodeRuntime?: NodeRuntime;
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
      // Also copy to a stable /tmp path so e2e failure diagnostics survive
      // the test runner's cleanup of userDataDir. EPD_EMBEDDED_DEBUG=1 enables.
      const debugPath = process.env.EPD_EMBEDDED_DEBUG ? '/tmp/epd-embedded-debug.log' : null;
      const debugStream = debugPath ? createWriteStream(debugPath, { flags: 'w' }) : null;
      const teeAll = (s: string | Buffer): void => {
        logStream.write(s);
        debugStream?.write(s);
      };
      teeAll(`\n--- embedded etherpad start @ ${new Date().toISOString()} (port ${port}) ---\n`);
      opts.log.info('starting embedded etherpad', { port, logPath });

      if (!opts.etherpadDir) {
        throw new Error(
          'Etherpad source not bundled. Run `pnpm fetch:etherpad` in packages/desktop ' +
            'to install it locally, or wait for the CI-bundled release.',
        );
      }
      const etherpadSrc = join(opts.etherpadDir, 'src');
      const node = opts.nodeRuntime ?? electronAsNode;
      const spawnMeta = `--- spawn cwd=${etherpadSrc} exec=${node.execPath} env+=${JSON.stringify(node.env)} ---\n`;
      teeAll(spawnMeta);
      opts.log.info('spawning embedded etherpad', { execPath: node.execPath, cwd: etherpadSrc });
      proc = spawnImpl(
        node.execPath,
        ['--require', 'tsx/cjs', 'node/server.ts', '--settings', settingsPath],
        {
          cwd: etherpadSrc,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, ...node.env, NODE_ENV: 'production' },
        },
      );
      proc.on('error', (err) => {
        teeAll(`--- spawn error: ${err.message} ---\n`);
        opts.log.error('embedded spawn error', { message: err.message });
      });
      proc.stdout?.on('data', (b: Buffer) => { teeAll(b); });
      proc.stderr?.on('data', (b: Buffer) => {
        teeAll(b);
        const chunk = b.toString();
        stderrTail = (stderrTail + chunk).slice(-stderrTailLimit);
        if (process.env.EPD_LOG_EMBEDDED) process.stderr.write(`[embedded] ${chunk}`);
      });
      proc.on('exit', (code, signal) => {
        opts.log.warn('embedded etherpad exited', { code, signal });
        const exitMsg = `--- exited code=${code} signal=${signal} ---\n`;
        logStream.end(exitMsg);
        debugStream?.end(exitMsg);
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
      // 120 seconds: bundled-source spawn skips the npx download but
      // Etherpad's own boot does tsx-compile of every TS file on first
      // run (~30-60s cold, much faster warm). Slow disks / busy CPU
      // can push that further. Previously 480s when we did the npx
      // download; 90s was too tight under e2e jitter.
      await waitForReachable(url, 120_000, () => exitedEarly, () => stderrTail);
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
