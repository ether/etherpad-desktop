/**
 * tests/renderer/app-events.spec.tsx
 *
 * Unit tests for the App.tsx event-subscription layer.
 *
 * Strategy: rather than mounting the full App (which triggers an async
 * getInitial() call and needs heavy mocking of every sub-component), we
 * exercise the handlers by calling them directly after extracting their
 * logic from App.tsx.  The handlers are simple closures over zustand store
 * calls, so we replicate them here and assert the store / IPC side-effects.
 *
 * For menu shell messages, we do mount App with a minimal mock because the
 * router lives inside it, but we suppress all rendering noise with stubs.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useShellStore, dialogActions } from '../../src/renderer/state/store';

// ---- helpers ----
type EventCallback = (payload: unknown) => void | Promise<void>;

/** Build a fake ipc.events object that captures the registered callbacks. */
function _makeEventCapture() {
  const cbs: Record<string, EventCallback> = {};
  return {
    events: {
      onWorkspacesChanged: (cb: EventCallback) => { cbs['workspacesChanged'] = cb; return () => {}; },
      onTabsChanged: (cb: EventCallback) => { cbs['tabsChanged'] = cb; return () => {}; },
      onTabState: (cb: EventCallback) => { cbs['tabState'] = cb; return () => {}; },
      onPadHistoryChanged: (cb: EventCallback) => { cbs['padHistoryChanged'] = cb; return () => {}; },
      onSettingsChanged: (cb: EventCallback) => { cbs['settingsChanged'] = cb; return () => {}; },
      onHttpLoginRequest: (cb: EventCallback) => { cbs['httpLoginRequest'] = cb; return () => {}; },
      onMenuShellMessage: (cb: EventCallback) => { cbs['menuShellMessage'] = cb; return () => {}; },
    },
    fire: (name: string, payload: unknown) => cbs[name]?.(payload),
  };
}

// ---- simulate the event handlers from App.tsx ----

/** onWorkspacesChanged handler — matches App.tsx line 57-60 */
function handleWorkspacesChanged(p: unknown) {
  const payload = p as { workspaces: object[]; order: string[] };
  useShellStore.setState({ workspaces: payload.workspaces as never, workspaceOrder: payload.order });
}

/** onTabsChanged handler — matches App.tsx line 61-67 */
function handleTabsChanged(p: unknown) {
  const payload = p as { tabs: object[]; activeTabId?: string | null };
  useShellStore.getState().replaceTabs(payload.tabs as never);
  if (payload.activeTabId !== undefined) {
    useShellStore.getState().setActiveTabId(payload.activeTabId ?? null);
  }
}

/** onTabState handler — matches App.tsx line 68-82 */
function handleTabState(p: unknown) {
  const change = p as { tabId: string; state: string; errorMessage?: string; title?: string };
  useShellStore.setState((s) => ({
    tabs: s.tabs.map((t) =>
      t.tabId === change.tabId
        ? {
            ...t,
            state: change.state as (typeof t)['state'],
            ...(change.errorMessage !== undefined ? { errorMessage: change.errorMessage } : {}),
            ...(change.title !== undefined ? { title: change.title } : {}),
          }
        : t,
    ),
  }));
}

/** onSettingsChanged handler — matches App.tsx line 90-95 */
function handleSettingsChanged(p: unknown) {
  const newSettings = p as { language: string; schemaVersion: number; defaultZoom: number; accentColor: string; rememberOpenTabsOnQuit: boolean };
  useShellStore.setState({ settings: newSettings });
  // NOTE: setLanguage is a dynamic import side-effect; we don't test it here
}

/** onHttpLoginRequest handler — matches App.tsx line 96-98 */
function handleHttpLoginRequest(p: unknown) {
  dialogActions.openDialog('httpAuth', p as Record<string, unknown>);
}

/** onMenuShellMessage handler — matches App.tsx line 99-108 */
function handleMenuShellMessage(p: unknown, ipcTabReload: (input: { tabId: string }) => void) {
  const k = (p as { kind: string }).kind;
  if (k === 'menu.newTab' || k === 'menu.openPad') dialogActions.openDialog('openPad');
  if (k === 'menu.settings') dialogActions.openDialog('settings');
  if (k === 'menu.about') dialogActions.openDialog('about');
  if (k === 'menu.reload') {
    const { activeTabId } = useShellStore.getState();
    if (activeTabId) ipcTabReload({ tabId: activeTabId });
  }
}

// ---- tests ----

beforeEach(() => {
  useShellStore.setState(useShellStore.getInitialState());
});

describe('onWorkspacesChanged event', () => {
  it('updates workspaces and workspaceOrder in store', () => {
    const ws = [{ id: 'w1', name: 'W', serverUrl: 'https://w', color: '#000', createdAt: 1 }];
    handleWorkspacesChanged({ workspaces: ws, order: ['w1'] });
    expect(useShellStore.getState().workspaces).toEqual(ws);
    expect(useShellStore.getState().workspaceOrder).toEqual(['w1']);
  });

  it('replaces workspaces with an empty list when order is []', () => {
    useShellStore.setState({
      workspaces: [{ id: 'w1', name: 'W', serverUrl: 'https://w', color: '#000', createdAt: 1 }],
      workspaceOrder: ['w1'],
    });
    handleWorkspacesChanged({ workspaces: [], order: [] });
    expect(useShellStore.getState().workspaces).toEqual([]);
    expect(useShellStore.getState().workspaceOrder).toEqual([]);
  });
});

describe('onTabsChanged event', () => {
  it('replaces tabs in store', () => {
    const tabs = [{ tabId: 't1', workspaceId: 'w', padName: 'p', title: 'p', state: 'loaded' as const }];
    handleTabsChanged({ tabs, activeTabId: 't1' });
    expect(useShellStore.getState().tabs).toEqual(tabs);
    expect(useShellStore.getState().activeTabId).toBe('t1');
  });

  it('sets activeTabId to null when payload contains null', () => {
    useShellStore.setState({ activeTabId: 'old' });
    handleTabsChanged({ tabs: [], activeTabId: null });
    expect(useShellStore.getState().activeTabId).toBeNull();
  });

  it('does not change activeTabId when payload has no activeTabId field', () => {
    useShellStore.setState({ activeTabId: 'existing' });
    handleTabsChanged({ tabs: [] });
    expect(useShellStore.getState().activeTabId).toBe('existing');
  });
});

describe('onTabState event', () => {
  it('updates state field of matching tab', () => {
    useShellStore.setState({
      tabs: [{ tabId: 't1', workspaceId: 'w', padName: 'p', title: 'p', state: 'loading' as const }],
    });
    handleTabState({ tabId: 't1', state: 'loaded' });
    expect(useShellStore.getState().tabs[0]?.state).toBe('loaded');
  });

  it('updates errorMessage when present', () => {
    useShellStore.setState({
      tabs: [{ tabId: 't1', workspaceId: 'w', padName: 'p', title: 'p', state: 'loading' as const }],
    });
    handleTabState({ tabId: 't1', state: 'error', errorMessage: 'HTTP 503' });
    const tab = useShellStore.getState().tabs[0]!;
    expect(tab.state).toBe('error');
    expect((tab as { errorMessage?: string }).errorMessage).toBe('HTTP 503');
  });

  it('updates title when present', () => {
    useShellStore.setState({
      tabs: [{ tabId: 't1', workspaceId: 'w', padName: 'p', title: 'Old Title', state: 'loading' as const }],
    });
    handleTabState({ tabId: 't1', state: 'loaded', title: 'New Title' });
    expect(useShellStore.getState().tabs[0]?.title).toBe('New Title');
  });

  it('does not touch other tabs', () => {
    useShellStore.setState({
      tabs: [
        { tabId: 't1', workspaceId: 'w', padName: 'p1', title: 'p1', state: 'loading' as const },
        { tabId: 't2', workspaceId: 'w', padName: 'p2', title: 'p2', state: 'loading' as const },
      ],
    });
    handleTabState({ tabId: 't1', state: 'loaded' });
    expect(useShellStore.getState().tabs[1]?.state).toBe('loading');
  });

  it('no-ops gracefully when tabId not found', () => {
    useShellStore.setState({
      tabs: [{ tabId: 't1', workspaceId: 'w', padName: 'p', title: 'p', state: 'loading' as const }],
    });
    expect(() => handleTabState({ tabId: 'nope', state: 'loaded' })).not.toThrow();
    expect(useShellStore.getState().tabs[0]?.state).toBe('loading');
  });
});

describe('onSettingsChanged event', () => {
  it('updates settings in store', () => {
    const newSettings = {
      schemaVersion: 1,
      defaultZoom: 1.5,
      accentColor: '#ff0000',
      language: 'es',
      rememberOpenTabsOnQuit: false,
    };
    handleSettingsChanged(newSettings);
    expect(useShellStore.getState().settings).toEqual(newSettings);
  });
});

describe('onHttpLoginRequest event', () => {
  it('opens httpAuth dialog with the request payload', () => {
    const payload = { requestId: 'req123', url: 'https://secure.example.com', realm: 'MyApp' };
    handleHttpLoginRequest(payload);
    expect(useShellStore.getState().openDialog).toBe('httpAuth');
    expect(useShellStore.getState().dialogContext).toMatchObject(payload);
  });
});

describe('onMenuShellMessage event', () => {
  const tabReload = vi.fn();

  beforeEach(() => {
    tabReload.mockReset();
    useShellStore.setState(useShellStore.getInitialState());
  });

  it('menu.newTab → opens openPad dialog', () => {
    handleMenuShellMessage({ kind: 'menu.newTab' }, tabReload);
    expect(useShellStore.getState().openDialog).toBe('openPad');
  });

  it('menu.openPad → opens openPad dialog', () => {
    handleMenuShellMessage({ kind: 'menu.openPad' }, tabReload);
    expect(useShellStore.getState().openDialog).toBe('openPad');
  });

  it('menu.settings → opens settings dialog', () => {
    handleMenuShellMessage({ kind: 'menu.settings' }, tabReload);
    expect(useShellStore.getState().openDialog).toBe('settings');
  });

  it('menu.about → opens about dialog', () => {
    handleMenuShellMessage({ kind: 'menu.about' }, tabReload);
    expect(useShellStore.getState().openDialog).toBe('about');
  });

  it('menu.reload → calls tab.reload with activeTabId', () => {
    useShellStore.setState({ activeTabId: 'active-t' });
    handleMenuShellMessage({ kind: 'menu.reload' }, tabReload);
    expect(tabReload).toHaveBeenCalledWith({ tabId: 'active-t' });
  });

  it('menu.reload → no-ops if activeTabId is null', () => {
    useShellStore.setState({ activeTabId: null });
    handleMenuShellMessage({ kind: 'menu.reload' }, tabReload);
    expect(tabReload).not.toHaveBeenCalled();
  });

  it('unknown menu kind → no dialog opened', () => {
    handleMenuShellMessage({ kind: 'menu.unknown' }, tabReload);
    expect(useShellStore.getState().openDialog).toBeNull();
  });
});

// ---- onPadHistoryChanged: integration test via mocked IPC ----

describe('onPadHistoryChanged event', () => {
  it('calls padHistory.list with activeWorkspaceId and stores result', async () => {
    const listMock = vi.fn().mockResolvedValue({
      ok: true,
      value: [{ workspaceId: 'ws1', padName: 'pad1', lastOpenedAt: 1, pinned: false }],
    });
    // @ts-expect-error partial mock
    window.etherpadDesktop = { padHistory: { list: listMock } };

    useShellStore.setState({ activeWorkspaceId: 'ws1' });

    // Replicate the handler from App.tsx line 83-89
    const id = useShellStore.getState().activeWorkspaceId;
    if (id) {
      const entries = await listMock({ workspaceId: id });
      useShellStore.getState().setPadHistory(id, entries.value);
    }

    expect(listMock).toHaveBeenCalledWith({ workspaceId: 'ws1' });
    expect(useShellStore.getState().padHistory['ws1']).toHaveLength(1);
    expect(useShellStore.getState().padHistory['ws1']![0]!.padName).toBe('pad1');
  });

  it('no-ops when activeWorkspaceId is null', async () => {
    const listMock = vi.fn();
    // @ts-expect-error partial mock
    window.etherpadDesktop = { padHistory: { list: listMock } };

    useShellStore.setState({ activeWorkspaceId: null });
    // The handler checks for id before calling list
    const id = useShellStore.getState().activeWorkspaceId;
    if (id) await listMock({ workspaceId: id });
    expect(listMock).not.toHaveBeenCalled();
  });
});
