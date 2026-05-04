import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PadHistoryStore } from '../../../src/main/pads/pad-history-store';

const WS_A = '00000000-0000-4000-8000-000000000001';
const WS_B = '00000000-0000-4000-8000-000000000002';

let dir: string;
let store: PadHistoryStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'epd-hist-'));
  store = new PadHistoryStore(join(dir, 'pad-history.json'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('PadHistoryStore', () => {
  it('starts empty for any workspace', () => {
    expect(store.listForWorkspace(WS_A)).toEqual([]);
  });

  it('upserts an entry and stamps lastOpenedAt', () => {
    store.touch(WS_A, 'standup');
    const list = store.listForWorkspace(WS_A);
    expect(list).toHaveLength(1);
    expect(list[0]?.padName).toBe('standup');
    expect(list[0]?.pinned).toBe(false);
  });

  it('updates lastOpenedAt on re-touch (no duplicate)', async () => {
    store.touch(WS_A, 'p');
    const t1 = store.listForWorkspace(WS_A)[0]!.lastOpenedAt;
    await new Promise((r) => setTimeout(r, 5));
    store.touch(WS_A, 'p');
    const list = store.listForWorkspace(WS_A);
    expect(list).toHaveLength(1);
    expect(list[0]!.lastOpenedAt).toBeGreaterThan(t1);
  });

  it('isolates entries per workspace', () => {
    store.touch(WS_A, 'p');
    store.touch(WS_B, 'q');
    expect(store.listForWorkspace(WS_A).map((e) => e.padName)).toEqual(['p']);
    expect(store.listForWorkspace(WS_B).map((e) => e.padName)).toEqual(['q']);
  });

  it('orders by lastOpenedAt descending in listForWorkspace', async () => {
    store.touch(WS_A, 'first');
    await new Promise((r) => setTimeout(r, 2));
    store.touch(WS_A, 'second');
    expect(store.listForWorkspace(WS_A).map((e) => e.padName)).toEqual(['second', 'first']);
  });

  it('pin / unpin sets the flag', () => {
    store.touch(WS_A, 'p');
    store.pin(WS_A, 'p');
    expect(store.listForWorkspace(WS_A)[0]!.pinned).toBe(true);
    store.unpin(WS_A, 'p');
    expect(store.listForWorkspace(WS_A)[0]!.pinned).toBe(false);
  });

  it('FIFO-evicts unpinned entries past 200 per workspace', () => {
    for (let i = 0; i < 205; i++) store.touch(WS_A, `pad-${i}`);
    const list = store.listForWorkspace(WS_A);
    expect(list).toHaveLength(200);
    expect(list.find((e) => e.padName === 'pad-0')).toBeUndefined();
    expect(list.find((e) => e.padName === 'pad-204')).toBeDefined();
  });

  it('does not evict pinned entries even past cap', () => {
    store.touch(WS_A, 'pinned-pad');
    store.pin(WS_A, 'pinned-pad');
    for (let i = 0; i < 205; i++) store.touch(WS_A, `pad-${i}`);
    const list = store.listForWorkspace(WS_A);
    expect(list.find((e) => e.padName === 'pinned-pad')).toBeDefined();
  });

  it('clearWorkspace wipes a single workspace', () => {
    store.touch(WS_A, 'p');
    store.touch(WS_B, 'q');
    store.clearWorkspace(WS_A);
    expect(store.listForWorkspace(WS_A)).toEqual([]);
    expect(store.listForWorkspace(WS_B)).toHaveLength(1);
  });

  it('clearAll wipes everything', () => {
    store.touch(WS_A, 'p');
    store.touch(WS_B, 'q');
    store.clearAll();
    expect(store.listForWorkspace(WS_A)).toEqual([]);
    expect(store.listForWorkspace(WS_B)).toEqual([]);
  });

  it('snapshot/restore round-trips state', () => {
    store.touch(WS_A, 'p');
    const snap = store.snapshot();
    store.touch(WS_A, 'q');
    store.restore(snap);
    expect(store.listForWorkspace(WS_A).map((e) => e.padName)).toEqual(['p']);
  });
});
