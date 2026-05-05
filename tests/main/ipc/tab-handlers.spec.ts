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
    getUserName: () => '',
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

  it('returns InvalidPayloadError for empty padName', async () => {
    const ws = workspaces.add({ name: 'A', serverUrl: 'https://x', color: '#000000' });
    const r = await h.open(undefined, { workspaceId: ws.id, padName: '', mode: 'open' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('InvalidPayloadError');
  });

  it('passes mode=create through to the src resolution', async () => {
    const ws = workspaces.add({ name: 'A', serverUrl: 'https://x', color: '#000000' });
    const r = await h.open(undefined, { workspaceId: ws.id, padName: 'newpad', mode: 'create' });
    expect(r.ok).toBe(true);
    expect(openInActive).toHaveBeenCalledWith(
      expect.objectContaining({ padName: 'newpad' }),
    );
  });

  it('emits tabsChanged and padHistoryChanged after opening', async () => {
    const emitTabs = vi.fn();
    const emitHist = vi.fn();
    h = tabHandlers({
      workspaces,
      padHistory,
      padSync,
      openInActiveWindow: openInActive,
      closeInAnyWindow: vi.fn(),
      focusInAnyWindow: vi.fn(),
      reloadInAnyWindow: vi.fn(),
      emitTabsChanged: emitTabs,
      emitPadHistoryChanged: emitHist,
      getLanguage: () => 'en',
      getUserName: () => '',
    });
    const ws = workspaces.add({ name: 'A', serverUrl: 'https://x', color: '#000000' });
    await h.open(undefined, { workspaceId: ws.id, padName: 'foo', mode: 'open' });
    expect(emitTabs).toHaveBeenCalled();
    expect(emitHist).toHaveBeenCalled();
  });
});

describe('tab.close', () => {
  it('calls closeInAnyWindow and emits tabsChanged', async () => {
    const closeInAny = vi.fn();
    const emitTabs = vi.fn();
    h = tabHandlers({
      workspaces,
      padHistory,
      padSync,
      openInActiveWindow: openInActive,
      closeInAnyWindow: closeInAny,
      focusInAnyWindow: vi.fn(),
      reloadInAnyWindow: vi.fn(),
      emitTabsChanged: emitTabs,
      emitPadHistoryChanged: vi.fn(),
      getLanguage: () => 'en',
      getUserName: () => '',
    });
    const r = await h.close(undefined, { tabId: 'some-tab' });
    expect(r.ok).toBe(true);
    expect(closeInAny).toHaveBeenCalledWith('some-tab');
    expect(emitTabs).toHaveBeenCalled();
  });

  it('returns InvalidPayloadError for empty tabId', async () => {
    const r = await h.close(undefined, { tabId: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('InvalidPayloadError');
  });
});

describe('tab.focus', () => {
  it('calls focusInAnyWindow and emits tabsChanged', async () => {
    const focusInAny = vi.fn();
    const emitTabs = vi.fn();
    h = tabHandlers({
      workspaces,
      padHistory,
      padSync,
      openInActiveWindow: openInActive,
      closeInAnyWindow: vi.fn(),
      focusInAnyWindow: focusInAny,
      reloadInAnyWindow: vi.fn(),
      emitTabsChanged: emitTabs,
      emitPadHistoryChanged: vi.fn(),
      getLanguage: () => 'en',
      getUserName: () => '',
    });
    const r = await h.focus(undefined, { tabId: 'tab-42' });
    expect(r.ok).toBe(true);
    expect(focusInAny).toHaveBeenCalledWith('tab-42');
    expect(emitTabs).toHaveBeenCalled();
  });

  it('returns InvalidPayloadError for empty tabId', async () => {
    const r = await h.focus(undefined, { tabId: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('InvalidPayloadError');
  });
});

describe('tab.reload', () => {
  it('calls reloadInAnyWindow with the tabId', async () => {
    const reloadInAny = vi.fn();
    h = tabHandlers({
      workspaces,
      padHistory,
      padSync,
      openInActiveWindow: openInActive,
      closeInAnyWindow: vi.fn(),
      focusInAnyWindow: vi.fn(),
      reloadInAnyWindow: reloadInAny,
      emitTabsChanged: vi.fn(),
      emitPadHistoryChanged: vi.fn(),
      getLanguage: () => 'en',
      getUserName: () => '',
    });
    const r = await h.reload(undefined, { tabId: 'tab-reload' });
    expect(r.ok).toBe(true);
    expect(reloadInAny).toHaveBeenCalledWith('tab-reload');
  });

  it('returns InvalidPayloadError for empty tabId', async () => {
    const r = await h.reload(undefined, { tabId: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('InvalidPayloadError');
  });
});
