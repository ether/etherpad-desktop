import { createServer, type Server } from 'node:http';

const PORT = 9003;
const HOST = '127.0.0.1';

export type EtherpadInstance = {
  url: string;
  stop(): Promise<void>;
};

/**
 * E2E fixture: a tiny HTTP server that *looks like* Etherpad to the desktop
 * shell.
 *
 * Why a mock instead of a real Etherpad: a real Etherpad spawn is huge,
 * slow on cold runners, and depends on `etherpad-lite@latest` from npm —
 * which doesn't exist (Etherpad core is GitHub-only). The desktop shell
 * tests don't need a real editor; they verify shell behaviour (workspace
 * add, rail, dialogs, focus, etc.). For those tests this is sufficient:
 *
 * - GET /api/    → JSON with `currentVersion` (passes the desktop's
 *                  "is this an Etherpad server?" probe).
 * - GET /p/<n>   → minimal HTML "<title>n - Etherpad</title>"
 *                  (so document.title gets set on the WebContentsView,
 *                  which the tab-state machinery surfaces as a tab title).
 * - GET /p/<n>/export/txt → a fixed body so the pad-content-index can
 *                  index something.
 * - default      → 404 with a JSON body.
 *
 * Sets a session cookie on /p/ so partition-isolation tests still verify
 * that workspaces don't share cookies.
 */

let cachedServer: Server | null = null;
let cachedUrl = '';

function pageHtml(padName: string): string {
  return `<!doctype html><html><head><title>${padName} - Etherpad</title></head><body><div id="pad-body">Mock pad: ${padName}</div></body></html>`;
}

async function probeExistingEtherpad(url: string): Promise<boolean> {
  try {
    const r = await fetch(`${url}/api/`);
    if (!r.ok) return false;
    const text = await r.text();
    return text.includes('currentVersion');
  } catch {
    return false;
  }
}

export async function startEtherpad(): Promise<EtherpadInstance> {
  if (cachedServer || cachedUrl) {
    return { url: cachedUrl, stop: async () => {} };
  }

  const server = createServer((req, res) => {
    const url = req.url ?? '/';
    if (url === '/api/' || url === '/api') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ currentVersion: '1.9.0' }));
      return;
    }
    if (url.startsWith('/p/')) {
      // /p/<name>[/export/txt]
      const rest = url.slice('/p/'.length);
      const slash = rest.indexOf('/');
      const padName = decodeURIComponent(slash === -1 ? rest : rest.slice(0, slash));
      const sub = slash === -1 ? '' : rest.slice(slash);
      if (sub === '/export/txt') {
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
        res.end(`Mock content for ${padName}`);
        return;
      }
      // Set a per-pad session cookie so partition-isolation tests can
      // observe distinct cookie jars between workspace partitions.
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'set-cookie': `epfixture=${encodeURIComponent(padName)}; Path=/`,
      });
      res.end(pageHtml(padName));
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'not found', path: url }));
  });

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(PORT, HOST, () => {
        server.off('error', reject);
        resolve();
      });
    });
    cachedServer = server;
    cachedUrl = `http://${HOST}:${PORT}`;
  } catch (e) {
    // EADDRINUSE: someone else is already on this port. If it's an
    // Etherpad-shaped service (e.g. the user runs the snap locally on
    // 9003), use it as the fixture target; otherwise rethrow.
    const url = `http://${HOST}:${PORT}`;
    if ((e as NodeJS.ErrnoException).code === 'EADDRINUSE' && (await probeExistingEtherpad(url))) {
      cachedUrl = url;
      // Don't cache `server` — it failed to listen. globalTeardown becomes
      // a no-op for this branch.
    } else {
      throw e;
    }
  }

  return {
    url: cachedUrl,
    stop: async () => {
      // No-op while cached. Real shutdown happens in globalTeardown.
    },
  };
}

export async function stopAllEtherpads(): Promise<void> {
  if (cachedServer) {
    await new Promise<void>((resolve) => cachedServer!.close(() => resolve()));
    cachedServer = null;
    cachedUrl = '';
  }
}

export async function seedPad(url: string, padName: string, _content: string): Promise<void> {
  // Touch the pad URL so any test that depends on the cookie being set has
  // it. The mock doesn't persist content — _content is accepted but ignored.
  await fetch(`${url}/p/${encodeURIComponent(padName)}`);
}
