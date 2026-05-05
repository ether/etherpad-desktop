import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TabManager } from '../../../src/main/tabs/tab-manager';
import type { PadView } from '../../../src/main/pads/pad-view-factory';

function fakeView(): PadView {
  return {
    webContents: {
      loadURL: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      getUserAgent: vi.fn(() => 'Mozilla/5.0 Test'),
      setUserAgent: vi.fn(),
      focus: vi.fn(),
      id: 1,
    },
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

  // REGRESSION: 2026-05-05 — user reported a pad opening multiple times
  // when clicked quickly in succession. The dedup check looked for an
  // existing tab BEFORE awaiting factory.create(); two concurrent opens
  // both passed the check and both pushed their own view, producing
  // duplicate tabs. Coalesce concurrent opens for the same key.
  it('coalesces rapid concurrent opens for the same (workspaceId, padName)', async () => {
    // Slow factory: returns a promise that resolves on the next tick so
    // both calls overlap inside open().
    let resolveCreate!: (v: PadView) => void;
    factory.create = vi.fn().mockImplementation(
      () => new Promise<PadView>((r) => { resolveCreate = r; }),
    );
    const p1 = mgr.open({ workspaceId: WS_A, padName: 'samepad', src: 'https://x/p/samepad' });
    const p2 = mgr.open({ workspaceId: WS_A, padName: 'samepad', src: 'https://x/p/samepad' });
    // Resolve the (single) factory call.
    resolveCreate(fakeView());
    const [a, b] = await Promise.all([p1, p2]);
    expect(b.tabId).toBe(a.tabId);
    expect(factory.create).toHaveBeenCalledTimes(1);
    expect(host.add).toHaveBeenCalledTimes(1);
  });

  it('coalesces three concurrent opens too — all share one tab', async () => {
    let resolveCreate!: (v: PadView) => void;
    factory.create = vi.fn().mockImplementation(
      () => new Promise<PadView>((r) => { resolveCreate = r; }),
    );
    const opens = [
      mgr.open({ workspaceId: WS_A, padName: 'pad', src: 'https://x/p/pad' }),
      mgr.open({ workspaceId: WS_A, padName: 'pad', src: 'https://x/p/pad' }),
      mgr.open({ workspaceId: WS_A, padName: 'pad', src: 'https://x/p/pad' }),
    ];
    resolveCreate(fakeView());
    const results = await Promise.all(opens);
    const ids = new Set(results.map((t) => t.tabId));
    expect(ids.size).toBe(1);
    expect(factory.create).toHaveBeenCalledTimes(1);
  });

  it('after a coalesced open finishes, a later open with the same key returns the same tab', async () => {
    const a = await mgr.open({ workspaceId: WS_A, padName: 'p', src: 'https://x/p/p' });
    const b = await mgr.open({ workspaceId: WS_A, padName: 'p', src: 'https://x/p/p' });
    expect(b.tabId).toBe(a.tabId);
    // The inflight map should be empty after each open() resolves —
    // verified indirectly by factory.create being called exactly once
    // across two completed (non-overlapping) opens.
    expect(factory.create).toHaveBeenCalledTimes(1);
  });

  it('positions the active view to the main area on resize', async () => {
    mgr.setActiveWorkspace(WS_A);
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

  it('setPadViewsHidden(true) hides all open pad views', async () => {
    mgr.setActiveWorkspace(WS_A);
    const t = await mgr.open({ workspaceId: WS_A, padName: 'p', src: 'https://x/p/p' });
    const v = mgr.viewFor(t.tabId)!;
    vi.clearAllMocks();
    mgr.setPadViewsHidden(true);
    expect(v.setVisible).toHaveBeenCalledWith(false);
  });

  it('setPadViewsHidden(false) restores visibility of active-workspace tabs', async () => {
    mgr.setActiveWorkspace(WS_A);
    const t = await mgr.open({ workspaceId: WS_A, padName: 'p', src: 'https://x/p/p' });
    const v = mgr.viewFor(t.tabId)!;
    mgr.setPadViewsHidden(true);
    vi.clearAllMocks();
    mgr.setPadViewsHidden(false);
    expect(v.setVisible).toHaveBeenCalledWith(true);
  });

  it('focus() hides previously-active tab and shows newly-focused tab', async () => {
    mgr.setActiveWorkspace(WS_A);
    const a = await mgr.open({ workspaceId: WS_A, padName: 'a', src: 's' });
    const b = await mgr.open({ workspaceId: WS_A, padName: 'b', src: 's' });
    // After opening b, b is active; a should be hidden
    const va = mgr.viewFor(a.tabId)!;
    const vb = mgr.viewFor(b.tabId)!;
    const lastFor = (mock: ReturnType<typeof vi.fn>) =>
      mock.mock.calls[mock.mock.calls.length - 1]?.[0];
    expect(lastFor(va.setVisible as ReturnType<typeof vi.fn>)).toBe(false);
    expect(lastFor(vb.setVisible as ReturnType<typeof vi.fn>)).toBe(true);

    // Now focus a — a should become visible and b hidden
    mgr.focus(a.tabId);
    expect(lastFor(va.setVisible as ReturnType<typeof vi.fn>)).toBe(true);
    expect(lastFor(vb.setVisible as ReturnType<typeof vi.fn>)).toBe(false);
  });
});
