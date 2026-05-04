import { describe, it, expect } from 'vitest';
import { serializeWindowsForQuit } from '../../../src/main/app/quit-state';

type FakeWin = {
  window: { isDestroyed(): boolean };
  bounds(): { x: number; y: number; width: number; height: number };
  tabManager: {
    getActiveWorkspaceId(): string | null;
    listAll(): Array<{ workspaceId: string; padName: string }>;
  };
};

function makeWin(opts: {
  destroyed: boolean;
  bounds?: { x: number; y: number; width: number; height: number };
  activeWorkspaceId?: string | null;
  tabs?: Array<{ workspaceId: string; padName: string }>;
}): FakeWin {
  return {
    window: { isDestroyed: () => opts.destroyed },
    bounds: () => {
      if (opts.destroyed) throw new Error('Object has been destroyed');
      return opts.bounds ?? { x: 0, y: 0, width: 1280, height: 800 };
    },
    tabManager: {
      getActiveWorkspaceId: () => opts.activeWorkspaceId ?? null,
      listAll: () => opts.tabs ?? [],
    },
  };
}

describe('serializeWindowsForQuit', () => {
  it('skips destroyed windows so getBounds() never throws', () => {
    const live = makeWin({
      destroyed: false,
      bounds: { x: 10, y: 20, width: 800, height: 600 },
      activeWorkspaceId: 'abc',
      tabs: [{ workspaceId: 'abc', padName: 'p' }],
    });
    const dead = makeWin({ destroyed: true });
    const out = serializeWindowsForQuit([live, dead]);
    expect(out.windows).toHaveLength(1);
    expect(out.windows[0]?.bounds).toEqual({ x: 10, y: 20, width: 800, height: 600 });
    expect(out.windows[0]?.activeWorkspaceId).toBe('abc');
    expect(out.windows[0]?.openTabs).toEqual([{ workspaceId: 'abc', padName: 'p' }]);
  });

  it('returns empty windows array when all are destroyed', () => {
    const out = serializeWindowsForQuit([makeWin({ destroyed: true }), makeWin({ destroyed: true })]);
    expect(out).toEqual({ schemaVersion: 1, windows: [] });
  });

  it('handles an empty input list', () => {
    expect(serializeWindowsForQuit([])).toEqual({ schemaVersion: 1, windows: [] });
  });

  it('preserves order of live windows', () => {
    const a = makeWin({ destroyed: false, activeWorkspaceId: 'a' });
    const b = makeWin({ destroyed: true });
    const c = makeWin({ destroyed: false, activeWorkspaceId: 'c' });
    const out = serializeWindowsForQuit([a, b, c]);
    expect(out.windows.map((w) => w.activeWorkspaceId)).toEqual(['a', 'c']);
  });
});
