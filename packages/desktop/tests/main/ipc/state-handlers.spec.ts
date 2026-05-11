// tests/main/ipc/state-handlers.spec.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WorkspaceStore } from '../../../src/main/workspaces/workspace-store';
import { SettingsStore } from '../../../src/main/settings/settings-store';
import { PadHistoryStore } from '../../../src/main/pads/pad-history-store';
import { stateHandlers } from '../../../src/main/ipc/state-handlers';

let dir: string;
let workspaces: WorkspaceStore;
let settings: SettingsStore;
let padHistory: PadHistoryStore;
let h: ReturnType<typeof stateHandlers>;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'epd-sh-'));
  workspaces = new WorkspaceStore(join(dir, 'w.json'));
  settings = new SettingsStore(join(dir, 's.json'));
  padHistory = new PadHistoryStore(join(dir, 'h.json'));
  // PadHistoryStore exposes listForWorkspace; the handler uses it.
  h = stateHandlers({ workspaces, settings, padHistory });
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('getInitialState', () => {
  it('returns workspaces, order, settings', async () => {
    const ws = workspaces.add({ name: 'A', serverUrl: 'https://a', color: '#000000' });
    const r = await h.getInitial(undefined, {});
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.workspaces.map((w) => w.id)).toEqual([ws.id]);
      expect(r.value.workspaceOrder).toEqual([ws.id]);
      expect(r.value.settings.defaultZoom).toBe(1);
    }
  });

  // REGRESSION: 2026-05-05 — user reported "stored pads don't load into UI
  // on first launch; they only show up after clicking Open Pad". Root
  // cause was that getInitial returned workspaces+settings but NOT pad
  // history, so the renderer's sidebar started empty until a
  // pad-history-changed event fired (which only happens on open/touch).
  // Pin the contract: getInitial bundles padHistory for every workspace.
  it('eagerly bundles padHistory for every workspace so the sidebar renders on first paint', async () => {
    const wsA = workspaces.add({ name: 'A', serverUrl: 'https://a', color: '#000000' });
    const wsB = workspaces.add({ name: 'B', serverUrl: 'https://b', color: '#111111' });
    padHistory.touch(wsA.id, 'pad-a-1');
    padHistory.touch(wsA.id, 'pad-a-2');
    padHistory.touch(wsB.id, 'pad-b-1');

    const r = await h.getInitial(undefined, {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.padHistory).toBeDefined();
    expect(Object.keys(r.value.padHistory).sort()).toEqual([wsA.id, wsB.id].sort());
    expect(r.value.padHistory[wsA.id]?.map((e) => e.padName).sort()).toEqual(['pad-a-1', 'pad-a-2']);
    expect(r.value.padHistory[wsB.id]?.map((e) => e.padName)).toEqual(['pad-b-1']);
  });

  it('returns empty padHistory map when there are no workspaces', async () => {
    const r = await h.getInitial(undefined, {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.padHistory).toEqual({});
  });

  it('returns an empty array for a workspace with no history yet', async () => {
    const ws = workspaces.add({ name: 'Fresh', serverUrl: 'https://f', color: '#222222' });
    const r = await h.getInitial(undefined, {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.padHistory[ws.id]).toEqual([]);
  });
});
