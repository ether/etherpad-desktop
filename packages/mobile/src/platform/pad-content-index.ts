import { padUrl } from '@shared/url';

/**
 * Mobile pad-content cache for the QuickSwitcher. Mirrors the desktop
 * implementation in `packages/desktop/src/main/pads/pad-content-index.ts`:
 * on every tab open we kick off a fetch of `/export/txt`, cache the
 * result in memory, and search across cached entries when the user types.
 *
 * Differences from desktop:
 *  - Runs in the WebView renderer, so cross-origin fetches against the
 *    Etherpad server are subject to CORS. Etherpad core sets
 *    Access-Control-Allow-Origin on /export/txt for the public endpoint;
 *    if a deployment locks that down, content search degrades silently
 *    (the catch below swallows the network error).
 *  - No persistent cache. The map lives in memory for the session.
 *    Re-opening a previously-indexed pad re-fetches if older than the
 *    staleness window.
 *  - No `Logger` dependency — uses `console.debug`. There is no main
 *    process to forward to.
 *
 * The fuzzy-match implementation matches desktop's: direct substring,
 * token-prefix, one-edit-distance — so the user sees identical search
 * behaviour across shells.
 */

type CacheEntry = {
  workspaceId: string;
  padName: string;
  text: string;
  fetchedAt: number;
};

const STALENESS_MS = 5 * 60_000;
const MAX_ENTRIES = 500;

const cache = new Map<string, CacheEntry>();

function keyFor(workspaceId: string, padName: string): string {
  return `${workspaceId}::${padName}`;
}

function evictIfFull(): void {
  if (cache.size < MAX_ENTRIES) return;
  let oldestKey: string | undefined;
  let oldestAt = Infinity;
  for (const [k, v] of cache.entries()) {
    if (v.fetchedAt < oldestAt) {
      oldestAt = v.fetchedAt;
      oldestKey = k;
    }
  }
  if (oldestKey) cache.delete(oldestKey);
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 1) return 2;
  const m = a.length;
  const n = b.length;
  const dp: number[] = new Array(n + 1).fill(0);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]!;
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j - 1]!, dp[j]!);
      }
      prev = tmp;
    }
  }
  return dp[n]!;
}

function fuzzyMatch(text: string, q: string): { matched: boolean; index: number } {
  const tLower = text.toLowerCase();
  const qLower = q.toLowerCase();
  const directIdx = tLower.indexOf(qLower);
  if (directIdx >= 0) return { matched: true, index: directIdx };
  if (qLower.length >= 3) {
    const tokens = tLower.split(/[\s.,;:!?()[\]{}'"]+/);
    let cursor = 0;
    for (const tok of tokens) {
      if (tok.length === 0) {
        cursor += 1;
        continue;
      }
      const start = tLower.indexOf(tok, cursor);
      cursor = start + tok.length;
      if (tok.startsWith(qLower)) return { matched: true, index: start };
      if (
        tok.length >= qLower.length &&
        editDistance(tok.slice(0, qLower.length), qLower) <= 1
      ) {
        return { matched: true, index: start };
      }
    }
  }
  return { matched: false, index: -1 };
}

/**
 * Fetch `/export/txt` for a pad and cache the response.
 *
 * `force` bypasses the staleness check — use this for pads the user is
 * actively editing (we refresh on every search). The staleness path is
 * for "open this pad's history but don't re-fetch on every keystroke."
 *
 * Errors (CORS, 401, 404, network) are swallowed silently — content
 * search degrades to "no results for this pad" rather than throwing.
 */
export async function index(
  workspaceId: string,
  serverUrl: string,
  padName: string,
  opts?: { force?: boolean },
): Promise<void> {
  const key = keyFor(workspaceId, padName);
  const existing = cache.get(key);
  if (!opts?.force && existing && Date.now() - existing.fetchedAt < STALENESS_MS) return;
  try {
    const exportUrl = `${padUrl(serverUrl, padName)}/export/txt`;
    // `credentials: 'omit'` so we don't send cookies cross-origin to the
    // Etherpad server. Some deploys whitelist `Access-Control-Allow-Origin: *`
    // but reject credentialed requests. We're after public/readable pads
    // for the search index; private pads simply won't be searchable
    // (the user already sees them rendered in the iframe via the WebView's
    // own cookie jar, which is independent of this fetch).
    const res = await fetch(exportUrl, { credentials: 'omit' });
    if (!res.ok) {
      console.debug('[mobile/pad-content-index] fetch skipped', {
        padName,
        status: res.status,
      });
      return;
    }
    const text = await res.text();
    evictIfFull();
    cache.set(key, { workspaceId, padName, text, fetchedAt: Date.now() });
  } catch (e) {
    console.debug('[mobile/pad-content-index] fetch error', {
      padName,
      message: (e as Error).message,
    });
  }
}

export function search(
  query: string,
): Array<{ workspaceId: string; padName: string; snippet: string }> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: Array<{ workspaceId: string; padName: string; snippet: string }> = [];
  for (const entry of cache.values()) {
    const m = fuzzyMatch(entry.text, q);
    if (!m.matched) continue;
    const idx = m.index;
    const start = Math.max(0, idx - 20);
    const end = Math.min(entry.text.length, idx + q.length + 40);
    let snippet = entry.text.slice(start, end);
    if (start > 0) snippet = '… ' + snippet;
    if (end < entry.text.length) snippet = snippet + ' …';
    hits.push({ workspaceId: entry.workspaceId, padName: entry.padName, snippet });
  }
  return hits.slice(0, 50);
}

export function clear(workspaceId?: string): void {
  if (!workspaceId) {
    cache.clear();
    return;
  }
  for (const [key, entry] of cache.entries()) {
    if (entry.workspaceId === workspaceId) cache.delete(key);
  }
}

/** Test seam: lets tests poke entries in directly without going through
 *  fetch. The capacitor.ts boot path only calls index() / search() /
 *  clear() — this is wider but kept narrow by the `__` prefix. */
export function __seedForTests(entries: Array<{ workspaceId: string; padName: string; text: string }>): void {
  for (const e of entries) {
    cache.set(keyFor(e.workspaceId, e.padName), {
      workspaceId: e.workspaceId,
      padName: e.padName,
      text: e.text,
      fetchedAt: Date.now(),
    });
  }
}
