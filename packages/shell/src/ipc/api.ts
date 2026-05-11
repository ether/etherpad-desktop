import type { IpcResult, InitialState, Workspace } from '@shared/ipc/channels';
import { AppError } from '@shared/types/errors';

/**
 * The runtime surface this file reads at every call. Mirrors today's preload
 * `EtherpadDesktopApi` verbatim. Phase 2a (this state) reads it from
 * `window.etherpadDesktop` directly; Task 5 introduces the `setPlatform()` /
 * `getPlatform()` seam and renames this to the public `Platform` interface.
 */
interface RuntimeApi {
  state: { getInitial(): Promise<unknown> };
  workspace: {
    list(): Promise<unknown>;
    add(input: { name: string; serverUrl?: string; color: string; kind?: 'remote' | 'embedded' }): Promise<unknown>;
    update(input: { id: string; name?: string; serverUrl?: string; color?: string }): Promise<unknown>;
    remove(input: { id: string }): Promise<unknown>;
    reorder(input: { order: string[] }): Promise<unknown>;
  };
  tab: {
    open(input: { workspaceId: string; padName: string; mode?: 'open' | 'create' }): Promise<unknown>;
    close(input: { tabId: string }): Promise<unknown>;
    focus(input: { tabId: string }): Promise<unknown>;
    reload(input: { tabId: string }): Promise<unknown>;
    hardReload(input: { tabId: string }): Promise<unknown>;
  };
  window: {
    setActiveWorkspace(input: { workspaceId: string | null }): Promise<unknown>;
    reloadShell(): Promise<unknown>;
    setPadViewsHidden(hidden: boolean): Promise<unknown>;
    setRailCollapsed(collapsed: boolean): Promise<unknown>;
  };
  padHistory: {
    list(input: { workspaceId: string }): Promise<unknown>;
    pin(input: { workspaceId: string; padName: string }): Promise<unknown>;
    unpin(input: { workspaceId: string; padName: string }): Promise<unknown>;
    clearRecent(input: { workspaceId: string }): Promise<unknown>;
    clearAll(): Promise<unknown>;
  };
  settings: {
    get(): Promise<unknown>;
    update(patch: Record<string, unknown>): Promise<unknown>;
  };
  httpLogin: {
    respond(input: { requestId: string; cancel?: boolean; username?: string; password?: string }): Promise<unknown>;
  };
  updater: {
    checkNow(): Promise<unknown>;
    installAndRestart(): Promise<unknown>;
    getState(): Promise<unknown>;
  };
  quickSwitcher: {
    searchPadContent(input: { query: string }): Promise<unknown>;
  };
  events: {
    onWorkspacesChanged(l: (p: unknown) => void): () => void;
    onPadHistoryChanged(l: (p: unknown) => void): () => void;
    onTabsChanged(l: (p: unknown) => void): () => void;
    onTabState(l: (p: unknown) => void): () => void;
    onSettingsChanged(l: (p: unknown) => void): () => void;
    onHttpLoginRequest(l: (p: unknown) => void): () => void;
    onUpdaterState(l: (p: unknown) => void): () => void;
    onPadFastSwitch(l: (p: { key: string }) => void): () => void;
    onMenuShellMessage(l: (p: unknown) => void): () => void;
  };
}

// Read lazily so tests can replace `window.etherpadDesktop` between tests.
// Phase 2a: still reads the global directly. Task 5 introduces the Platform
// seam (setPlatform/getPlatform) and removes this coupling.
const api = (): RuntimeApi =>
  (window as unknown as { etherpadDesktop: RuntimeApi }).etherpadDesktop;

async function unwrap<T>(p: Promise<IpcResult<T> | unknown>): Promise<T> {
  const r = (await p) as IpcResult<T>;
  if (r && typeof r === 'object' && 'ok' in r) {
    if (r.ok) return r.value;
    throw new AppError(r.error.kind, r.error.message);
  }
  return r as T;
}

export const ipc = {
  state: {
    getInitial: () => unwrap<InitialState>(api().state.getInitial() as never),
  },
  workspace: {
    list: () => unwrap<{ workspaces: Workspace[]; order: string[] }>(api().workspace.list() as never),
    add: (input: { name: string; serverUrl?: string; color: string; kind?: 'remote' | 'embedded' }) =>
      unwrap<Workspace>(api().workspace.add(input) as never),
    update: (input: { id: string; name?: string; serverUrl?: string; color?: string }) =>
      unwrap<Workspace>(api().workspace.update(input) as never),
    remove: (input: { id: string }) => unwrap<{ ok: true }>(api().workspace.remove(input) as never),
    reorder: (input: { order: string[] }) => unwrap<string[]>(api().workspace.reorder(input) as never),
  },
  tab: {
    open: (input: { workspaceId: string; padName: string; mode?: 'open' | 'create' }) =>
      unwrap<{ tabId: string; workspaceId: string; padName: string; title: string; state: string }>(
        api().tab.open(input) as never,
      ),
    close: (input: { tabId: string }) => unwrap<{ ok: true }>(api().tab.close(input) as never),
    focus: (input: { tabId: string }) => unwrap<{ ok: true }>(api().tab.focus(input) as never),
    reload: (input: { tabId: string }) => unwrap<{ ok: true }>(api().tab.reload(input) as never),
    hardReload: (input: { tabId: string }) => unwrap<{ ok: true }>(api().tab.hardReload(input) as never),
  },
  window: {
    setActiveWorkspace: (workspaceId: string | null) =>
      unwrap<{ ok: true }>(api().window.setActiveWorkspace({ workspaceId }) as never),
    reloadShell: () => unwrap<{ ok: true }>(api().window.reloadShell() as never),
    setPadViewsHidden: (hidden: boolean) =>
      unwrap<{ ok: true }>(api().window.setPadViewsHidden(hidden) as never),
    setRailCollapsed: (collapsed: boolean) =>
      unwrap<{ ok: true }>(api().window.setRailCollapsed(collapsed) as never),
  },
  padHistory: {
    list: (workspaceId: string) =>
      unwrap<Array<{ workspaceId: string; padName: string; lastOpenedAt: number; pinned: boolean; title?: string }>>(
        api().padHistory.list({ workspaceId }) as never,
      ),
    pin: (workspaceId: string, padName: string) =>
      unwrap<{ ok: true }>(api().padHistory.pin({ workspaceId, padName }) as never),
    unpin: (workspaceId: string, padName: string) =>
      unwrap<{ ok: true }>(api().padHistory.unpin({ workspaceId, padName }) as never),
    clearRecent: (workspaceId: string) =>
      unwrap<{ ok: true }>(api().padHistory.clearRecent({ workspaceId }) as never),
    clearAll: () => unwrap<{ ok: true }>(api().padHistory.clearAll() as never),
  },
  settings: {
    get: () => unwrap(api().settings.get() as never),
    update: (patch: Record<string, unknown>) => unwrap(api().settings.update(patch) as never),
  },
  httpLogin: {
    respond: (input: { requestId: string; cancel?: boolean; username?: string; password?: string }) =>
      unwrap<{ ok: true }>(api().httpLogin.respond(input) as never),
  },
  updater: {
    checkNow: () => unwrap<{ ok: true }>(api().updater.checkNow() as never),
    installAndRestart: () => unwrap<{ ok: true }>(api().updater.installAndRestart() as never),
    getState: () => api().updater.getState() as Promise<unknown>,
  },
  quickSwitcher: {
    searchPadContent: (query: string) =>
      api().quickSwitcher.searchPadContent({ query }) as Promise<
        Array<{ workspaceId: string; padName: string; snippet: string }>
      >,
  },
  get events() {
    return api().events;
  },
};
