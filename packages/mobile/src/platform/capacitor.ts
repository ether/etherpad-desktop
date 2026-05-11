import type { Platform } from '@etherpad/shell';

/**
 * Stub `CapacitorPlatform` for Phase 3. Returns empty state for every read
 * so the shell renders its first-launch UI (the non-dismissable
 * `AddWorkspaceDialog`). Write methods reject with NOT_IMPLEMENTED — Phase 4
 * replaces these with `@capacitor/preferences` + `@capacitor/filesystem`.
 *
 * Events are no-op subscribers: the unsubscribe fn does nothing because
 * nothing ever fires. Mobile is single-window so cross-process events aren't
 * meaningful; Phase 4 may add an in-process mitt bus if components want to
 * fire local events.
 *
 * All reads that flow through `ipc.ts`'s `unwrap()` helper return the
 * `{ ok: true, value: ... }` IPC envelope shape. Methods that bypass
 * unwrap (`updater.getState`, `quickSwitcher.searchPadContent`, the events)
 * return raw values per the shell's type contract.
 */
export function createCapacitorPlatform(): Platform {
  const ok = Promise.resolve({ ok: true });
  const okValue = <T>(value: T) => Promise.resolve({ ok: true, value });
  const notImpl = (op: string) =>
    Promise.reject(new Error(`[mobile/Phase 3] ${op} not implemented yet`));
  const noopUnsubscribe = (): (() => void) => () => {};

  const defaultSettings = {
    schemaVersion: 1 as const,
    defaultZoom: 1,
    accentColor: '#3366cc',
    language: 'en',
    rememberOpenTabsOnQuit: true,
    minimizeToTray: false,
    themePreference: 'auto' as const,
    userName: '',
  };

  return {
    state: {
      getInitial: () =>
        okValue({
          workspaces: [],
          workspaceOrder: [],
          settings: defaultSettings,
          padHistory: {},
        }),
    },
    workspace: {
      list: () => okValue({ workspaces: [], order: [] }),
      add: () => notImpl('workspace.add'),
      update: () => notImpl('workspace.update'),
      remove: () => notImpl('workspace.remove'),
      reorder: () => notImpl('workspace.reorder'),
    },
    tab: {
      open: () => notImpl('tab.open'),
      close: () => notImpl('tab.close'),
      focus: () => notImpl('tab.focus'),
      reload: () => notImpl('tab.reload'),
      hardReload: () => notImpl('tab.hardReload'),
    },
    window: {
      setActiveWorkspace: () => ok,
      reloadShell: () => {
        window.location.reload();
        return ok;
      },
      setPadViewsHidden: () => ok,
      setRailCollapsed: () => ok,
    },
    padHistory: {
      list: () => okValue([]),
      pin: () => notImpl('padHistory.pin'),
      unpin: () => notImpl('padHistory.unpin'),
      clearRecent: () => notImpl('padHistory.clearRecent'),
      clearAll: () => notImpl('padHistory.clearAll'),
    },
    settings: {
      get: () => okValue(defaultSettings),
      update: () => notImpl('settings.update'),
    },
    httpLogin: {
      respond: () => notImpl('httpLogin.respond'),
    },
    updater: {
      checkNow: () => notImpl('updater.checkNow'),
      installAndRestart: () => notImpl('updater.installAndRestart'),
      // Raw (not unwrapped) — return UpdaterState shape directly.
      getState: () => Promise.resolve({ kind: 'unsupported', reason: 'mobile' }),
    },
    quickSwitcher: {
      // Raw (not unwrapped) — return an array directly.
      searchPadContent: () => Promise.resolve([]),
    },
    events: {
      onWorkspacesChanged: noopUnsubscribe,
      onPadHistoryChanged: noopUnsubscribe,
      onTabsChanged: noopUnsubscribe,
      onTabState: noopUnsubscribe,
      onSettingsChanged: noopUnsubscribe,
      onHttpLoginRequest: noopUnsubscribe,
      onUpdaterState: noopUnsubscribe,
      onPadFastSwitch: noopUnsubscribe,
      onMenuShellMessage: noopUnsubscribe,
    },
  };
}
