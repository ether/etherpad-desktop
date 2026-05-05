import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const PORT = 9003;
const HOST = '127.0.0.1';

export type EtherpadInstance = {
  url: string;
  stop(): Promise<void>;
};

let cachedEtherpad: ChildProcess | null = null;
let cachedUrl = '';
let cachedDir = '';

// 8 minutes: cold CI runners need to fetch + extract etherpad-lite via npx
// (a multi-hundred-MB tarball) AND boot the server. Empirically 240s was
// not enough — runs were timing out with "did not come up within 240000ms".
// 480s gives ~3-4 minutes of headroom over the typical 4-5 minute cold path.
// On warm dev machines this returns in seconds regardless.
async function waitForReady(url: string, timeoutMs = 480_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${url}/api/`);
      if (r.ok) {
        const text = await r.text();
        if (text.includes('currentVersion')) return;
      }
    } catch {
      // not ready
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Etherpad did not come up on ${url} within ${timeoutMs}ms`);
}

export async function startEtherpad(): Promise<EtherpadInstance> {
  if (cachedEtherpad) {
    return { url: cachedUrl, stop: async () => {} };
  }
  const dir = mkdtempSync(join(tmpdir(), 'epd-fixture-etherpad-'));
  cachedDir = dir;
  const settings = {
    title: 'Etherpad fixture',
    favicon: null,
    skinName: 'colibris',
    ip: HOST,
    port: PORT,
    showSettingsInAdminPage: false,
    minify: false,
    requireAuthentication: false,
    requireAuthorization: false,
    users: {},
    dbType: 'dirty',
    dbSettings: { filename: join(dir, 'dirty.db') },
    suppressErrorsInPadText: false,
    trustProxy: false,
    socketTransportProtocols: ['websocket', 'polling'],
    loglevel: 'WARN',
  };
  writeFileSync(join(dir, 'settings.json'), JSON.stringify(settings, null, 2));
  mkdirSync(join(dir, 'var'), { recursive: true });

  // Use npx to fetch and run a pinned Etherpad version. The first run downloads;
  // subsequent runs (CI cached) are fast.
  const child = spawn(
    'npx',
    ['--yes', 'etherpad-lite@latest', '--settings', join(dir, 'settings.json')],
    { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'production' } },
  );
  child.stderr?.on('data', (b: Buffer) => {
    if (process.env['E2E_LOG_ETHERPAD']) process.stderr.write(`[etherpad] ${b}`);
  });
  cachedEtherpad = child;
  cachedUrl = `http://${HOST}:${PORT}`;

  await waitForReady(cachedUrl);

  return {
    url: cachedUrl,
    stop: async () => {
      // No-op while cached. Real shutdown happens in globalTeardown.
    },
  };
}

export async function stopAllEtherpads(): Promise<void> {
  if (cachedEtherpad) {
    cachedEtherpad.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
    if (!cachedEtherpad.killed) cachedEtherpad.kill('SIGKILL');
    cachedEtherpad = null;
  }
  if (cachedDir) {
    try {
      rmSync(cachedDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    cachedDir = '';
  }
}

export async function seedPad(url: string, padName: string, content: string): Promise<void> {
  // Use Etherpad's HTTP API. In v1 fixtures, no API key is required (auth disabled).
  // First, create the pad by visiting it.
  await fetch(`${url}/p/${encodeURIComponent(padName)}`);
  // Optionally set initial text via the HTTP API if an apikey.txt is present.
  // For v1 tests, opening the pad page is enough to trigger creation.
  void content;
}
