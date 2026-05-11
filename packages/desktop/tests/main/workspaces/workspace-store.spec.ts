import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WorkspaceStore } from '../../../src/main/workspaces/workspace-store';

let dir: string;
let store: WorkspaceStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'epd-ws-'));
  store = new WorkspaceStore(join(dir, 'workspaces.json'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('WorkspaceStore', () => {
  it('starts empty', () => {
    expect(store.list()).toEqual([]);
    expect(store.order()).toEqual([]);
  });

  it('adds a workspace and returns it', () => {
    const ws = store.add({ name: 'A', serverUrl: 'https://a', color: '#000000' });
    expect(ws.name).toBe('A');
    expect(ws.serverUrl).toBe('https://a');
    expect(ws.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.list()).toHaveLength(1);
    expect(store.order()).toEqual([ws.id]);
  });

  it('preserves insertion order', () => {
    const a = store.add({ name: 'A', serverUrl: 'https://a', color: '#000000' });
    const b = store.add({ name: 'B', serverUrl: 'https://b', color: '#000000' });
    expect(store.order()).toEqual([a.id, b.id]);
  });

  it('updates a workspace by id', () => {
    const ws = store.add({ name: 'A', serverUrl: 'https://a', color: '#000000' });
    store.update({ id: ws.id, name: 'A2' });
    expect(store.byId(ws.id)?.name).toBe('A2');
    expect(store.byId(ws.id)?.serverUrl).toBe('https://a');
  });

  it('throws WorkspaceNotFoundError for unknown id', () => {
    expect(() => store.update({ id: '00000000-0000-4000-8000-000000000000', name: 'x' })).toThrow();
  });

  it('removes a workspace from list and order', () => {
    const a = store.add({ name: 'A', serverUrl: 'https://a', color: '#000000' });
    const b = store.add({ name: 'B', serverUrl: 'https://b', color: '#000000' });
    store.remove(a.id);
    expect(store.list().map((w) => w.id)).toEqual([b.id]);
    expect(store.order()).toEqual([b.id]);
  });

  it('reorders workspaces', () => {
    const a = store.add({ name: 'A', serverUrl: 'https://a', color: '#000000' });
    const b = store.add({ name: 'B', serverUrl: 'https://b', color: '#000000' });
    store.reorder([b.id, a.id]);
    expect(store.order()).toEqual([b.id, a.id]);
  });

  it('reject reorder with mismatched id set', () => {
    store.add({ name: 'A', serverUrl: 'https://a', color: '#000000' });
    expect(() => store.reorder(['00000000-0000-4000-8000-000000000000'])).toThrow();
  });

  it('persists across instances', () => {
    const ws = store.add({ name: 'A', serverUrl: 'https://a', color: '#000000' });
    const store2 = new WorkspaceStore(join(dir, 'workspaces.json'));
    expect(store2.list()).toHaveLength(1);
    expect(store2.byId(ws.id)?.name).toBe('A');
  });

  it('normalises serverUrl on add', () => {
    const ws = store.add({ name: 'A', serverUrl: 'https://a.example.com/', color: '#000000' });
    expect(ws.serverUrl).toBe('https://a.example.com');
  });

  it('snapshot returns a deep copy independent from internal state', () => {
    store.add({ name: 'A', serverUrl: 'https://a', color: '#000000' });
    const snap = store.snapshot();
    snap.workspaces.push({ id: 'x', name: 'Y', serverUrl: 'https://y', color: '#000000', createdAt: 1 });
    expect(store.list()).toHaveLength(1);
  });

  it('restore() replaces state from a snapshot', () => {
    const a = store.add({ name: 'A', serverUrl: 'https://a', color: '#000000' });
    const snap = store.snapshot();
    store.add({ name: 'B', serverUrl: 'https://b', color: '#000000' });
    expect(store.list()).toHaveLength(2);
    store.restore(snap);
    expect(store.list().map((w) => w.id)).toEqual([a.id]);
  });
});
