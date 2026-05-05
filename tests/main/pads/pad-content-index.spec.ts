import { describe, it, expect, vi } from 'vitest';
import { createPadContentIndex } from '../../../src/main/pads/pad-content-index';

const fakeLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

describe('createPadContentIndex', () => {
  it('indexes a pad and returns content matches', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      expect(url).toContain('/p/standup/export/txt');
      return new Response('lots of monkey business today');
    }) as unknown as typeof fetch;

    const idx = createPadContentIndex({ log: fakeLog, fetchFn });
    await idx.index('ws1', 'https://x', 'standup');
    const hits = idx.search('monkey');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.padName).toBe('standup');
    expect(hits[0]?.snippet).toContain('monkey');
  });

  it('skips when fetch returns non-ok (e.g. auth required)', async () => {
    const fetchFn = vi.fn(async () => new Response('no', { status: 401 })) as unknown as typeof fetch;
    const idx = createPadContentIndex({ log: fakeLog, fetchFn });
    await idx.index('ws1', 'https://x', 'standup');
    expect(idx.search('anything')).toEqual([]);
  });

  it("clear() with workspaceId only drops that workspace's entries", async () => {
    const fetchFn = vi.fn(async () => new Response('hello world')) as unknown as typeof fetch;
    const idx = createPadContentIndex({ log: fakeLog, fetchFn });
    await idx.index('ws1', 'https://x', 'a');
    await idx.index('ws2', 'https://x', 'b');
    idx.clear('ws1');
    expect(idx.search('hello').map((h) => h.workspaceId)).toEqual(['ws2']);
  });

  it('does not re-fetch within staleness window', async () => {
    const fetchFn = vi.fn(async () => new Response('a')) as unknown as typeof fetch;
    const idx = createPadContentIndex({ log: fakeLog, fetchFn });
    await idx.index('ws1', 'https://x', 'p');
    await idx.index('ws1', 'https://x', 'p');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('returns empty array when query is empty', async () => {
    const fetchFn = vi.fn(async () => new Response('hello world')) as unknown as typeof fetch;
    const idx = createPadContentIndex({ log: fakeLog, fetchFn });
    await idx.index('ws1', 'https://x', 'p');
    expect(idx.search('')).toEqual([]);
    expect(idx.search('  ')).toEqual([]);
  });

  it('clear() with no argument clears all entries', async () => {
    const fetchFn = vi.fn(async () => new Response('hello world')) as unknown as typeof fetch;
    const idx = createPadContentIndex({ log: fakeLog, fetchFn });
    await idx.index('ws1', 'https://x', 'a');
    await idx.index('ws2', 'https://x', 'b');
    idx.clear();
    expect(idx.search('hello')).toEqual([]);
  });

  it('snippet includes context around the match', async () => {
    const fetchFn = vi.fn(async () =>
      new Response('prefix text monkey suffix text'),
    ) as unknown as typeof fetch;
    const idx = createPadContentIndex({ log: fakeLog, fetchFn });
    await idx.index('ws1', 'https://x', 'p');
    const hits = idx.search('monkey');
    expect(hits[0]?.snippet).toContain('monkey');
  });

  it('handles fetch errors gracefully without throwing', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('network error');
    }) as unknown as typeof fetch;
    const idx = createPadContentIndex({ log: fakeLog, fetchFn });
    await expect(idx.index('ws1', 'https://x', 'p')).resolves.toBeUndefined();
    expect(idx.search('anything')).toEqual([]);
  });
});
