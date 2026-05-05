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
        const idx = entry.text.toLowerCase().indexOf(q);
        if (idx >= 0) {
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
