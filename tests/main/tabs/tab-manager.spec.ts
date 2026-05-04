import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TabManager } from '../../../src/main/tabs/tab-manager';
import type { PadView } from '../../../src/main/pads/pad-view-factory';

function fakeView(): PadView {
  return {
    webContents: { loadURL: vi.fn().mockResolvedValue(undefined), on: vi.fn(), id: 1 },
    setBounds: vi.fn(),
    setVisible: vi.fn(),
  };
}

const WS_A = '00000000-0000-4000-8000-000000000001';

describe('TabManager', () => {
  let host: { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; mainArea: () => { x: number; y: number; width: number; height: number } };
  let factory: { create: ReturnType<typeof vi.fn> };
  let mgr: TabManager;
  let emitted: unknown[];

  beforeEach(() => {
    host = {
      add: vi.fn(),
      remove: vi.fn(),
      mainArea: () => ({ x: 0, y: 40, width: 1000, height: 760 }),
    };
    factory = { create: vi.fn().mockImplementation(async () => fakeView()) };
    emitted = [];
    mgr = new TabManager({
      viewHost: host,
      factory: factory as never,
      preloadPath: '/preload.cjs',
      onTabsChanged: (snap) => emitted.push({ kind: 'tabs', snap }),
      onTabState: (s) => emitted.push({ kind: 'state', s }),
    });
  });

  it('opens a new tab and adds the view to the host', async () => {
    const tab = await mgr.open({ workspaceId: WS_A, padName: 'p', src: 'https://x/p/p' });
    expect(tab.workspaceId).toBe(WS_A);
    expect(tab.padName).toBe('p');
    expect(tab.state).toBe('loading');
    expect(host.add).toHaveBeenCalledTimes(1);
    expect(factory.create).toHaveBeenCalledWith({
      workspaceId: WS_A,
      src: 'https://x/p/p',
      preloadPath: '/preload.cjs',
    });
  });

  it('focuses an existing tab instead of opening duplicate', async () => {
    const a = await mgr.open({ workspaceId: WS_A, padName: 'p', src: 'https://x/p/p' });
    const b = await mgr.open({ workspaceId: WS_A, padName: 'p', src: 'https://x/p/p' });
    expect(b.tabId).toBe(a.tabId);
    expect(factory.create).toHaveBeenCalledTimes(1);
  });

  it('positions the active view to the main area on resize', async () => {
    const tab = await mgr.open({ workspaceId: WS_A, padName: 'p', src: 'https://x/p/p' });
    mgr.layout();
    const view = mgr.viewFor(tab.tabId);
    expect(view!.setBounds).toHaveBeenCalledWith({ x: 0, y: 40, width: 1000, height: 760 });
  });

  it('hides views of inactive workspace on workspace switch', async () => {
    const t1 = await mgr.open({ workspaceId: WS_A, padName: 'p', src: 'https://x/p/p' });
    const v1 = mgr.viewFor(t1.tabId)!;
    mgr.setActiveWorkspace('00000000-0000-4000-8000-000000000099');
    expect(v1.setVisible).toHaveBeenCalledWith(false);
  });

  it('shows views of active workspace on switch back', async () => {
    const t1 = await mgr.open({ workspaceId: WS_A, padName: 'p', src: 'https://x/p/p' });
    const v1 = mgr.viewFor(t1.tabId)!;
    mgr.setActiveWorkspace('00000000-0000-4000-8000-000000000099');
    mgr.setActiveWorkspace(WS_A);
    expect(v1.setVisible).toHaveBeenLastCalledWith(true);
  });

  it('close removes the view and emits tabs:changed', async () => {
    const t = await mgr.open({ workspaceId: WS_A, padName: 'p', src: 'https://x/p/p' });
    mgr.close(t.tabId);
    expect(host.remove).toHaveBeenCalledTimes(1);
    expect(mgr.viewFor(t.tabId)).toBeUndefined();
    expect(emitted.some((e) => (e as { kind: string }).kind === 'tabs')).toBe(true);
  });

  it('listForWorkspace returns only the workspace tabs in insertion order', async () => {
    const a = await mgr.open({ workspaceId: WS_A, padName: 'a', src: 's' });
    const b = await mgr.open({ workspaceId: WS_A, padName: 'b', src: 's' });
    expect(mgr.listForWorkspace(WS_A).map((t) => t.tabId)).toEqual([a.tabId, b.tabId]);
  });
});
