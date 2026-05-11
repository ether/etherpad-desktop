// tests/main/ipc/pad-history-handlers.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PadHistoryStore } from '../../../src/main/pads/pad-history-store';
import { padHistoryHandlers } from '../../../src/main/ipc/pad-history-handlers';

let dir: string;
let padHistory: PadHistoryStore;
let emit: ReturnType<typeof vi.fn>;
let h: ReturnType<typeof padHistoryHandlers>;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'epd-phh-'));
  padHistory = new PadHistoryStore(join(dir, 'h.json'));
  emit = vi.fn();
  h = padHistoryHandlers({ padHistory, emit });
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

const WS_ID = '00000000-0000-4000-8000-000000000001';

describe('padHistory.list', () => {
  it('returns empty array for unknown workspace', async () => {
    const r = await h.list(undefined, { workspaceId: WS_ID });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual([]);
  });

  it('returns entries for a known workspace', async () => {
    padHistory.touch(WS_ID, 'mypad');
    const r = await h.list(undefined, { workspaceId: WS_ID });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toHaveLength(1);
      expect(r.value[0]!.padName).toBe('mypad');
    }
  });

  it('returns InvalidPayloadError for invalid workspaceId', async () => {
    const r = await h.list(undefined, { workspaceId: 'not-a-uuid' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('InvalidPayloadError');
  });
});

describe('padHistory.pin', () => {
  it('pins an existing entry and emits', async () => {
    padHistory.touch(WS_ID, 'standup');
    const r = await h.pin(undefined, { workspaceId: WS_ID, padName: 'standup' });
    expect(r.ok).toBe(true);
    expect(emit).toHaveBeenCalled();
    const entries = padHistory.listForWorkspace(WS_ID);
    expect(entries.find((e) => e.padName === 'standup')?.pinned).toBe(true);
  });

  it('silent no-op for unknown padName (does not throw)', async () => {
    const r = await h.pin(undefined, { workspaceId: WS_ID, padName: 'ghost' });
    // wrapHandler catches any throw → ok:false, but PadHistoryStore.pin is a silent no-op
    expect(r.ok).toBe(true);
    // emit was still called (the handler calls emit regardless)
    expect(emit).toHaveBeenCalled();
  });

  it('returns InvalidPayloadError when padName is empty', async () => {
    const r = await h.pin(undefined, { workspaceId: WS_ID, padName: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('InvalidPayloadError');
  });
});

describe('padHistory.unpin', () => {
  it('unpins an existing pinned entry and emits', async () => {
    padHistory.touch(WS_ID, 'standup');
    padHistory.pin(WS_ID, 'standup');
    const r = await h.unpin(undefined, { workspaceId: WS_ID, padName: 'standup' });
    expect(r.ok).toBe(true);
    expect(emit).toHaveBeenCalled();
    const entries = padHistory.listForWorkspace(WS_ID);
    expect(entries.find((e) => e.padName === 'standup')?.pinned).toBe(false);
  });

  it('silent no-op for unknown padName', async () => {
    const r = await h.unpin(undefined, { workspaceId: WS_ID, padName: 'ghost' });
    expect(r.ok).toBe(true);
  });
});

describe('padHistory.clearRecent', () => {
  it('clears all entries for a workspace', async () => {
    padHistory.touch(WS_ID, 'p1');
    padHistory.touch(WS_ID, 'p2');
    const r = await h.clearRecent(undefined, { workspaceId: WS_ID });
    expect(r.ok).toBe(true);
    expect(emit).toHaveBeenCalled();
    expect(padHistory.listForWorkspace(WS_ID)).toEqual([]);
  });

  it('no-ops on unknown workspace (succeeds with empty result)', async () => {
    const r = await h.clearRecent(undefined, { workspaceId: WS_ID });
    expect(r.ok).toBe(true);
  });
});

describe('padHistory.clearAll', () => {
  it('clears all entries across all workspaces', async () => {
    const WS2 = '00000000-0000-4000-8000-000000000002';
    padHistory.touch(WS_ID, 'p1');
    padHistory.touch(WS2, 'p2');
    const r = await h.clearAll(undefined, {});
    expect(r.ok).toBe(true);
    expect(emit).toHaveBeenCalled();
    expect(padHistory.listForWorkspace(WS_ID)).toEqual([]);
    expect(padHistory.listForWorkspace(WS2)).toEqual([]);
  });
});
