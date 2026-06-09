import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Downstream wire-compatibility — live smoke test (headless-light).
 *
 * Phase 2 of ether/etherpad#7923. This proves the desktop/mobile shell could
 * talk to a real Etherpad server *without* booting Electron. The full Electron
 * e2e stays in this repo's own CI; this gate is deliberately headless-light —
 * a plain HTTP roundtrip against the contract the shell depends on:
 *   1. create a pad via the HTTP API,
 *   2. fetch `/p/<pad>` (the exact URL the shell would load in its webview)
 *      and assert HTTP 200,
 *   3. read the pad text back via the API to confirm content.
 *
 * Env contract:
 *   - ETHERPAD_SMOKE_URL    server base URL (default http://localhost:9003)
 *   - ETHERPAD_SMOKE_APIKEY HTTP API key (required to actually run)
 *
 * Unless BOTH a reachable server and an API key are present, this SKIPS
 * cleanly — it must never fail CI for lack of test infrastructure.
 */

const BASE = (process.env.ETHERPAD_SMOKE_URL || 'http://localhost:9003').replace(/\/$/, '');
const APIKEY = process.env.ETHERPAD_SMOKE_APIKEY || '';
const API_VERSION = '1.2.13';

async function reachable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

async function api<T>(fn: string, params: Record<string, string>): Promise<ApiResponse<T>> {
  const qs = new URLSearchParams({ apikey: APIKEY, ...params });
  const res = await fetch(`${BASE}/api/${API_VERSION}/${fn}?${qs.toString()}`, {
    signal: AbortSignal.timeout(5000),
  });
  expect(res.status).toBe(200);
  return (await res.json()) as ApiResponse<T>;
}

let serverUp = false;

beforeAll(async () => {
  serverUp = await reachable();
});

describe('live server smoke (shell HTTP contract)', () => {
  it('completes a create -> fetch /p/<pad> -> getText roundtrip', async () => {
    if (!serverUp || !APIKEY) {
      const why = !serverUp ? `no Etherpad reachable at ${BASE}` : `ETHERPAD_SMOKE_APIKEY not set`;
      console.warn(
        `[smoke] ${why} — skipping live smoke test. ` +
          `Set ETHERPAD_SMOKE_URL + ETHERPAD_SMOKE_APIKEY to run it.`,
      );
      return; // skip cleanly: never fail the gate without a reachable server + key
    }

    const padID = `phase2-smoke-${Date.now()}`;
    const text = 'phase2 wire-compat smoke\n';

    const created = await api<null>('createPad', { padID, text });
    expect(created.code, created.message).toBe(0);

    // The exact URL the shell loads in its webview.
    const padRes = await fetch(`${BASE}/p/${encodeURIComponent(padID)}`, {
      signal: AbortSignal.timeout(5000),
    });
    expect(padRes.status).toBe(200);

    const got = await api<{ text: string }>('getText', { padID });
    expect(got.code, got.message).toBe(0);
    expect(got.data.text).toBe(text);

    await api<null>('deletePad', { padID });
  });
});
