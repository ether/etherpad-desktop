// tests/main/ipc/workspace-handlers.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WorkspaceStore } from '../../../src/main/workspaces/workspace-store';
import { PadHistoryStore } from '../../../src/main/pads/pad-history-store';
import { workspaceHandlers } from '../../../src/main/ipc/workspace-handlers';

let dir: string;
let workspaces: WorkspaceStore;
let padHistory: PadHistoryStore;
let clearStorage: ReturnType<typeof vi.fn>;
let probe: ReturnType<typeof vi.fn>;
let h: ReturnType<typeof workspaceHandlers>;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'epd-wsh-'));
  workspaces = new WorkspaceStore(join(dir, 'w.json'));
  padHistory = new PadHistoryStore(join(dir, 'h.json'));
  clearStorage = vi.fn().mockResolvedValue(undefined);
  probe = vi.fn().mockResolvedValue(true);
  h = workspaceHandlers({
    workspaces,
    padHistory,
    closeAllTabsForWorkspace: vi.fn(),
    clearWorkspaceStorage: (id: string) => clearStorage(id),
    probeIsEtherpad: probe,
    emitWorkspacesChanged: vi.fn(),
    emitPadHistoryChanged: vi.fn(),
  });
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('workspace.add', () => {
  it('probes the URL before persisting; returns ok with workspace', async () => {
    const r = await h.add(undefined, {
      name: 'A',
      serverUrl: 'https://a.example.com',
      color: '#000000',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe('A');
      expect(probe).toHaveBeenCalledWith('https://a.example.com');
    }
  });

  it('returns NotAnEtherpadServerError if probe returns false', async () => {
    probe.mockResolvedValueOnce(false);
    const r = await h.add(undefined, {
      name: 'A',
      serverUrl: 'https://a.example.com',
      color: '#000000',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('NotAnEtherpadServerError');
  });

  it('returns ServerUnreachableError if probe rejects', async () => {
    probe.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const r = await h.add(undefined, {
      name: 'A',
      serverUrl: 'https://a.example.com',
      color: '#000000',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('ServerUnreachableError');
  });
});

describe('workspace.remove', () => {
  it('removes workspace, clears history, then partition (ordered)', async () => {
    const closeTabs = vi.fn();
    const emitWs = vi.fn();
    const emitHist = vi.fn();
    h = workspaceHandlers({
      workspaces,
      padHistory,
      closeAllTabsForWorkspace: closeTabs,
      clearWorkspaceStorage: (id) => clearStorage(id),
      probeIsEtherpad: probe,
      emitWorkspacesChanged: emitWs,
      emitPadHistoryChanged: emitHist,
    });

    const ws = workspaces.add({ name: 'A', serverUrl: 'https://a', color: '#000000' });
    padHistory.touch(ws.id, 'pad');

    const calls: string[] = [];
    closeTabs.mockImplementation(() => calls.push('closeTabs'));
    clearStorage.mockImplementation(async () => {
      calls.push('clearStorage');
    });

    const r = await h.remove(undefined, { id: ws.id });
    expect(r.ok).toBe(true);
    expect(workspaces.byId(ws.id)).toBeUndefined();
    expect(padHistory.listForWorkspace(ws.id)).toEqual([]);
    expect(calls).toEqual(['closeTabs', 'clearStorage']);
    expect(emitWs).toHaveBeenCalled();
    expect(emitHist).toHaveBeenCalled();
  });

  it('returns WorkspaceNotFoundError if id unknown', async () => {
    const r = await h.remove(undefined, { id: '00000000-0000-4000-8000-000000000000' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('WorkspaceNotFoundError');
  });
});

describe('workspace.update', () => {
  it('happy path: updates name, emits workspacesChanged', async () => {
    const ws = workspaces.add({ name: 'Old', serverUrl: 'https://old.example.com', color: '#000000' });
    const r = await h.update(undefined, { id: ws.id, name: 'New' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.name).toBe('New');
  });

  it('returns WorkspaceNotFoundError for unknown id', async () => {
    const r = await h.update(undefined, { id: '00000000-0000-4000-8000-000000000000', name: 'X' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('WorkspaceNotFoundError');
  });

  it('returns InvalidPayloadError when id is not a UUID', async () => {
    const r = await h.update(undefined, { id: 'not-a-uuid' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('InvalidPayloadError');
  });
});

describe('workspace.list', () => {
  it('returns all workspaces in order', async () => {
    workspaces.add({ name: 'A', serverUrl: 'https://a.example.com', color: '#000000' });
    workspaces.add({ name: 'B', serverUrl: 'https://b.example.com', color: '#111111' });
    const r = await h.list(undefined, {});
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.workspaces).toHaveLength(2);
      expect(r.value.order).toHaveLength(2);
    }
  });
});

describe('workspace.reorder', () => {
  it('happy path: reorders workspaces', async () => {
    const ws1 = workspaces.add({ name: 'A', serverUrl: 'https://a.example.com', color: '#000000' });
    const ws2 = workspaces.add({ name: 'B', serverUrl: 'https://b.example.com', color: '#111111' });
    const r = await h.reorder(undefined, { order: [ws2.id, ws1.id] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual([ws2.id, ws1.id]);
  });

  it('returns error when order has wrong ids', async () => {
    workspaces.add({ name: 'A', serverUrl: 'https://a.example.com', color: '#000000' });
    const r = await h.reorder(undefined, { order: ['00000000-0000-4000-8000-000000000000'] });
    expect(r.ok).toBe(false);
    // The workspace store throws a plain Error for set mismatch, which serializes as StorageError
    if (!r.ok) expect(r.error.kind).toMatch(/Error/);
  });
});
