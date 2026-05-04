import { contextBridge, ipcRenderer } from 'electron';
import { CH } from '../shared/ipc/channels.js';

const invoke = <T>(channel: string, payload?: unknown): Promise<T> =>
  ipcRenderer.invoke(channel, payload ?? {});

const on = (channel: string, listener: (payload: unknown) => void) => {
  const wrapped = (_e: unknown, payload: unknown) => listener(payload);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
};

const api = {
  state: {
    getInitial: () => invoke(CH.GET_INITIAL_STATE),
  },
  workspace: {
    list: () => invoke(CH.WORKSPACE_LIST),
    add: (input: { name: string; serverUrl: string; color: string }) => invoke(CH.WORKSPACE_ADD, input),
    update: (input: { id: string; name?: string; serverUrl?: string; color?: string }) =>
      invoke(CH.WORKSPACE_UPDATE, input),
    remove: (input: { id: string }) => invoke(CH.WORKSPACE_REMOVE, input),
    reorder: (input: { order: string[] }) => invoke(CH.WORKSPACE_REORDER, input),
  },
  tab: {
    open: (input: { workspaceId: string; padName: string; mode?: 'open' | 'create' }) =>
      invoke(CH.TAB_OPEN, { ...input, mode: input.mode ?? 'open' }),
    close: (input: { tabId: string }) => invoke(CH.TAB_CLOSE, input),
    focus: (input: { tabId: string }) => invoke(CH.TAB_FOCUS, input),
    reload: (input: { tabId: string }) => invoke(CH.TAB_RELOAD, input),
  },
  window: {
    setActiveWorkspace: (input: { workspaceId: string | null }) =>
      invoke(CH.WINDOW_SET_ACTIVE_WORKSPACE, input),
    reloadShell: () => invoke(CH.WINDOW_RELOAD_SHELL, {}),
  },
  padHistory: {
    list: (input: { workspaceId: string }) => invoke(CH.PAD_HISTORY_LIST, input),
    pin: (input: { workspaceId: string; padName: string }) => invoke(CH.PAD_HISTORY_PIN, input),
    unpin: (input: { workspaceId: string; padName: string }) => invoke(CH.PAD_HISTORY_UNPIN, input),
    clearRecent: (input: { workspaceId: string }) => invoke(CH.PAD_HISTORY_CLEAR_RECENT, input),
    clearAll: () => invoke(CH.PAD_HISTORY_CLEAR_ALL, {}),
  },
  settings: {
    get: () => invoke(CH.SETTINGS_GET),
    update: (patch: Record<string, unknown>) => invoke(CH.SETTINGS_UPDATE, patch),
  },
  events: {
    onWorkspacesChanged: (l: (p: unknown) => void) => on(CH.EV_WORKSPACES_CHANGED, l),
    onPadHistoryChanged: (l: (p: unknown) => void) => on(CH.EV_PAD_HISTORY_CHANGED, l),
    onTabsChanged: (l: (p: unknown) => void) => on(CH.EV_TABS_CHANGED, l),
    onTabState: (l: (p: unknown) => void) => on(CH.EV_TAB_STATE, l),
    onSettingsChanged: (l: (p: unknown) => void) => on(CH.EV_SETTINGS_CHANGED, l),
    onHttpLoginRequest: (l: (p: unknown) => void) => on(CH.EV_HTTP_LOGIN_REQUEST, l),
    onMenuShellMessage: (l: (p: unknown) => void) => {
      const channels = ['menu.newTab', 'menu.openPad', 'menu.reload', 'menu.settings', 'menu.about'];
      const offs = channels.map((c) => on(c, () => l({ kind: c })));
      return () => offs.forEach((o) => o());
    },
  },
  httpLogin: {
    respond: (input: { requestId: string; cancel?: boolean; username?: string; password?: string }) =>
      invoke('httpLogin.respond', input),
  },
};

contextBridge.exposeInMainWorld('etherpadDesktop', api);

export type EtherpadDesktopApi = typeof api;
