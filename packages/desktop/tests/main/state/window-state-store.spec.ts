import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WindowStateStore } from '../../../src/main/state/window-state-store';

let dir: string;
let store: WindowStateStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'epd-window-'));
  store = new WindowStateStore(join(dir, 'window-state.json'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('WindowStateStore', () => {
  it('returns defaults (empty windows array) if file missing', () => {
    expect(store.read()).toEqual({ schemaVersion: 1, windows: [] });
  });

  it('round-trips a saved layout', () => {
    const layout = {
      schemaVersion: 1 as const,
      windows: [
        {
          activeWorkspaceId: '00000000-0000-4000-8000-000000000000',
          bounds: { x: 100, y: 100, width: 1280, height: 800 },
          openTabs: [
            { workspaceId: '00000000-0000-4000-8000-000000000000', padName: 'p' },
          ],
          activeTabIndex: 0,
        },
      ],
    };
    store.save(layout);
    const s2 = new WindowStateStore(join(dir, 'window-state.json'));
    expect(s2.read()).toEqual(layout);
  });
});
