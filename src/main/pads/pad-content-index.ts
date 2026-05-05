import type { Logger } from '../logging/logger.js';
import { padUrl } from '@shared/url.js';

type CacheEntry = { text: string; fetchedAt: number };
type Key = string; // `${workspaceId}::${padName}`

const STALENESS_MS = 5 * 60_000; // re-fetch if older than 5 minutes
const MAX_ENTRIES = 500;

export type PadContentIndex = {
  index(workspaceId: string, serverUrl: string, padName: string): Promise<void>;
  search(query: string): Array<{ workspaceId: string; padName: string; snippet: string }>;
  clear(workspaceId?: string): void;
};

/**
 * Typo-tolerant substring match.
 *
 * 1. Direct substring (exact, fast path).
 * 2. Token-prefix: any whitespace/punctuation-separated token that starts
 *    with the query (catches "monki" → "monkey").
 * 3. One-character edit-distance on a token (catches "cit" → "cat").
 *
 * Fuzzy matching only kicks in for queries of ≥ 3 characters to avoid
 * false positives on very short inputs.
 */
function fuzzyMatch(text: string, q: string): { matched: boolean; index: number } {
  const tLower = text.toLowerCase();
  const qLower = q.toLowerCase();

  // 1. Direct substring (current behaviour).
  const directIdx = tLower.indexOf(qLower);
  if (directIdx >= 0) return { matched: true, index: directIdx };

  // 2 & 3. Token-based fuzzy matching (only for ≥ 3-char queries).
  if (qLower.length >= 3) {
    const tokens = tLower.split(/[\s.,;:!?()\[\]{}'"]+/);
    let cursor = 0;
    for (const tok of tokens) {
      if (tok.length === 0) {
        cursor += 1;
        continue;
      }
      const start = tLower.indexOf(tok, cursor);
      cursor = start + tok.length;

      // 2. Prefix match.
      if (tok.startsWith(qLower)) return { matched: true, index: start };

      // 3. One-edit-distance match: compare the token's leading len(query)
      //    characters against the query. This catches "monki" → "monkey"
      //    because tok.slice(0,5) = "monke" has edit-distance 1 from "monki".
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

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 1) return 2; // bail early for our threshold
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

export function createPadContentIndex(opts: { log: Logger; fetchFn?: typeof fetch }): PadContentIndex {
  const cache = new Map<Key, CacheEntry & { workspaceId: string; padName: string }>();
  const fetchImpl = opts.fetchFn ?? fetch;

  function evictIfFull() {
    if (cache.size < MAX_ENTRIES) return;
    // FIFO eviction
    const oldest = [...cache.entries()].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt)[0];
    if (oldest) cache.delete(oldest[0]);
  }

  return {
    async index(workspaceId, serverUrl, padName) {
      const key = `${workspaceId}::${padName}`;
      const existing = cache.get(key);
      if (existing && Date.now() - existing.fetchedAt < STALENESS_MS) return;
      try {
        const exportUrl = `${padUrl(serverUrl, padName)}/export/txt`;
        const res = await fetchImpl(exportUrl);
        if (!res.ok) {
          // 401/403 = auth required; 404 = no such pad. Skip silently.
          opts.log.debug('pad content fetch skipped', { status: res.status });
          return;
        }
        const text = await res.text();
        evictIfFull();
        cache.set(key, { workspaceId, padName, text, fetchedAt: Date.now() });
      } catch (e) {
        opts.log.debug('pad content fetch error', { message: (e as Error).message });
      }
    },
    search(query) {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      const hits: Array<{ workspaceId: string; padName: string; snippet: string }> = [];
      for (const entry of cache.values()) {
        const m = fuzzyMatch(entry.text, q);
        if (m.matched) {
          const idx = m.index;
          // Build a 60-char snippet around the match.
          const start = Math.max(0, idx - 20);
          const end = Math.min(entry.text.length, idx + q.length + 40);
          let snippet = entry.text.slice(start, end);
          if (start > 0) snippet = '… ' + snippet;
          if (end < entry.text.length) snippet = snippet + ' …';
          hits.push({ workspaceId: entry.workspaceId, padName: entry.padName, snippet });
        }
      }
      return hits.slice(0, 50);
    },
    clear(workspaceId) {
      if (!workspaceId) {
        cache.clear();
        return;
      }
      for (const [key, entry] of cache.entries()) {
        if (entry.workspaceId === workspaceId) cache.delete(key);
      }
    },
  };
}
