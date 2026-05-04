// tests/main/ipc/tab-handlers.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WorkspaceStore } from '../../../src/main/workspaces/workspace-store';
import { PadHistoryStore } from '../../../src/main/pads/pad-history-store';
import { PadSyncService } from '../../../src/main/pads/pad-sync-service';
import { tabHandlers } from '../../../src/main/ipc/tab-handlers';

let dir: string;
let workspaces: WorkspaceStore;
let padHistory: PadHistoryStore;
let padSync: PadSyncService;
let openInActive: ReturnType<typeof vi.fn>;
let h: ReturnType<typeof tabHandlers>;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'epd-th-'));
  workspaces = new WorkspaceStore(join(dir, 'w.json'));
  padHistory = new PadHistoryStore(join(dir, 'h.json'));
  padSync = new PadSyncService();
  openInActive = vi.fn().mockResolvedValue({ tabId: 't1', workspaceId: 'x', padName: 'p', title: 'p', state: 'loading' });
  h = tabHandlers({
    workspaces,
    padHistory,
    padSync,
    openInActiveWindow: openInActive,
    closeInAnyWindow: vi.fn(),
    focusInAnyWindow: vi.fn(),
    reloadInAnyWindow: vi.fn(),
    emitTabsChanged: vi.fn(),
    emitPadHistoryChanged: vi.fn(),
    getLanguage: () => 'en',
  });
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('tab.open', () => {
  it('resolves src via PadSyncService and stamps history', async () => {
    const ws = workspaces.add({ name: 'A', serverUrl: 'https://x', color: '#000000' });
    const r = await h.open(undefined, { workspaceId: ws.id, padName: 'foo', mode: 'open' });
    expect(r.ok).toBe(true);
    expect(openInActive).toHaveBeenCalledWith({
      workspaceId: ws.id,
      padName: 'foo',
      src: 'https://x/p/foo?lang=en',
    });
    expect(padHistory.listForWorkspace(ws.id)).toHaveLength(1);
    expect(padHistory.listForWorkspace(ws.id)[0]!.padName).toBe('foo');
  });

  it('returns WorkspaceNotFoundError for unknown workspace', async () => {
    const r = await h.open(undefined, {
      workspaceId: '00000000-0000-4000-8000-000000000000',
      padName: 'foo',
      mode: 'open',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('WorkspaceNotFoundError');
  });
});
