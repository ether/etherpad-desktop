import type { IpcResult, InitialState, Workspace } from '@shared/ipc/channels';
import { AppError } from '@shared/types/errors';

/**
 * The runtime adapter the shell calls into. Mirrors today's preload
 * `EtherpadDesktopApi` verbatim — desktop's `createElectronPlatform()`
 * returns the preload-injected `window.etherpadDesktop` as a `Platform`.
 *
 * Phase 2b will refactor toward the abstract `storage`/`padView`/`events`
 * sub-interfaces from spec §4 once mobile has a real implementation
 * driving the shape.
 */
/**
 * Static feature flags the runtime advertises to the shell so the UI
 * can drop or surface controls that only apply on certain platforms.
 * Treated as an immutable snapshot of the runtime — flags don't change
 * within a session.
 *
 * Default-on at the type level so adding a new flag doesn't silently
 * break older runtimes that haven't been recompiled with it.
 */
export type PlatformCapabilities = {
  /** Whether the runtime exposes a system tray that the app can
   *  minimise to instead of quitting. Desktop: true. Mobile: false
   *  (Android has no tray; the OS manages app lifecycle). */
  tray: boolean;
};

export interface Platform {
  /** Static capabilities snapshot. Read synchronously by UI code that
   *  conditionally renders platform-specific controls (e.g. the Settings
   *  dialog's "minimise to tray" checkbox). */
  capabilities: PlatformCapabilities;
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

let injected: Platform | null = null;

export function setPlatform(p: Platform): void {
  injected = p;
}

export function getPlatform(): Platform {
  if (!injected) {
    throw new Error(
      '[@etherpad/shell] setPlatform() must be called before any IPC. ' +
        'Desktop calls it in renderer/index.tsx; mobile calls it in src/main.tsx.',
    );
  }
  return injected;
}

/** Test-only: clear the injected platform between tests. */
export function __resetPlatformForTests(): void {
  injected = null;
}

// Read lazily so each call routes through the currently-injected platform.
const api = (): Platform => getPlatform();

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
