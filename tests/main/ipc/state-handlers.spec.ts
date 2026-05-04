// tests/main/ipc/state-handlers.spec.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WorkspaceStore } from '../../../src/main/workspaces/workspace-store';
import { SettingsStore } from '../../../src/main/settings/settings-store';
import { stateHandlers } from '../../../src/main/ipc/state-handlers';

let dir: string;
let workspaces: WorkspaceStore;
let settings: SettingsStore;
let h: ReturnType<typeof stateHandlers>;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'epd-sh-'));
  workspaces = new WorkspaceStore(join(dir, 'w.json'));
  settings = new SettingsStore(join(dir, 's.json'));
  h = stateHandlers({ workspaces, settings });
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
});
