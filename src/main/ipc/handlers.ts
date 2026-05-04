import { ipcMain, BrowserWindow, session } from 'electron';
import { randomUUID } from 'node:crypto';
import { CH } from '@shared/ipc/channels';
import { workspaceHandlers } from './workspace-handlers.js';
import { tabHandlers } from './tab-handlers.js';
import { stateHandlers } from './state-handlers.js';
import { windowHandlers } from './window-handlers.js';
import { settingsHandlers } from './settings-handlers.js';
import { padHistoryHandlers } from './pad-history-handlers.js';
import { PadSyncService } from '../pads/pad-sync-service.js';
import { clearWorkspaceStorage } from '../workspaces/session.js';
import type { AppContext } from '../app/lifecycle.js';

export type IpcRegistration = {
  broadcastShell: (channel: string, payload?: unknown) => void;
  emitTabsChanged: () => void;
  emitTabState: (window: unknown, change: { tabId: string; state: string; errorMessage?: string; title?: string }) => void;
  requestHttpLogin: (host: string, realm?: string) => Promise<{ cancel: boolean; username?: string; password?: string; requestId: string }>;
};

export function registerIpc(ctx: AppContext): IpcRegistration {
  const padSync = new PadSyncService();
  const pendingHttpLogins = new Map<string, (resp: { cancel: boolean; username?: string; password?: string; requestId: string }) => void>();

  const broadcastShell = (channel: string, payload?: unknown) => {
    for (const w of ctx.windowManager.list()) {
      w.shellView.webContents.send(channel, payload);
    }
  };

  const emitWorkspacesChanged = () =>
    broadcastShell(CH.EV_WORKSPACES_CHANGED, { workspaces: ctx.workspaces.list(), order: ctx.workspaces.order() });
  const emitPadHistoryChanged = () =>
    broadcastShell(CH.EV_PAD_HISTORY_CHANGED, { ts: Date.now() });
  const emitTabsChanged = () => {
    for (const w of ctx.windowManager.list()) {
      w.shellView.webContents.send(CH.EV_TABS_CHANGED, {
        tabs: w.tabManager.listAll(),
        activeTabId: w.tabManager.getActiveTabId(),
      });
    }
  };
  const emitTabState = (_window: unknown, change: { tabId: string; state: string; errorMessage?: string; title?: string }) => {
    broadcastShell(CH.EV_TAB_STATE, change);
  };
  const emitSettingsChanged = () => broadcastShell(CH.EV_SETTINGS_CHANGED, ctx.settings.get());

  const closeAllTabsForWorkspace = (workspaceId: string) => {
    for (const w of ctx.windowManager.list()) {
      const tabs = w.tabManager.listForWorkspace(workspaceId);
      for (const t of tabs) w.tabManager.close(t.tabId);
    }
  };

  const probeIsEtherpad = async (serverUrl: string): Promise<boolean> => {
    const res = await fetch(`${serverUrl}/api/`, { method: 'GET' });
    if (!res.ok) return false;
    const text = await res.text();
    try {
      const json = JSON.parse(text) as unknown;
      return typeof json === 'object' && json !== null && 'currentVersion' in json;
    } catch {
      return false;
    }
  };

  const ws = workspaceHandlers({
    workspaces: ctx.workspaces,
    padHistory: ctx.padHistory,
    closeAllTabsForWorkspace,
    clearWorkspaceStorage: (id) => clearWorkspaceStorage(session, id),
    probeIsEtherpad,
    emitWorkspacesChanged,
    emitPadHistoryChanged,
  });

  const openInActiveWindow = async (input: { workspaceId: string; padName: string; src: string }) => {
    const w = ctx.windowManager.list()[0];
    if (!w) throw new Error('no window');
    return w.tabManager.open(input);
  };

  const closeInAnyWindow = (tabId: string) => {
    for (const w of ctx.windowManager.list()) {
      if (w.tabManager.viewFor(tabId)) {
        w.tabManager.close(tabId);
        return;
      }
    }
  };

  const focusInAnyWindow = (tabId: string) => {
    for (const w of ctx.windowManager.list()) {
      if (w.tabManager.viewFor(tabId)) {
        w.tabManager.focus(tabId);
        return;
      }
    }
  };

  const reloadInAnyWindow = (tabId: string) => {
    for (const w of ctx.windowManager.list()) {
      const v = w.tabManager.viewFor(tabId);
      if (v) {
        (v.webContents as unknown as { reload: () => void }).reload();
        return;
      }
    }
  };

  const tabs = tabHandlers({
    workspaces: ctx.workspaces,
    padHistory: ctx.padHistory,
    padSync,
    openInActiveWindow,
    closeInAnyWindow,
    focusInAnyWindow,
    reloadInAnyWindow,
    emitTabsChanged,
    emitPadHistoryChanged,
  });

  const wins = windowHandlers({
    setActiveWorkspaceForActiveWindow: (id) => {
      const w = ctx.windowManager.list()[0];
      w?.tabManager.setActiveWorkspace(id);
    },
    reloadShellOfActiveWindow: () => {
      const w = ctx.windowManager.list()[0];
      w?.shellView.webContents.reload();
    },
    setPadViewsHiddenForActiveWindow: (hidden) => {
      const w = ctx.windowManager.list()[0];
      w?.tabManager.setPadViewsHidden(hidden);
    },
    emitTabsChanged,
  });

  const setts = settingsHandlers({ settings: ctx.settings, emitSettingsChanged });
  const state = stateHandlers({ workspaces: ctx.workspaces, settings: ctx.settings });
  const hist = padHistoryHandlers({ padHistory: ctx.padHistory, emit: emitPadHistoryChanged });

  const register = (channel: string, h: (event: unknown, payload: unknown) => Promise<unknown>) => {
    ipcMain.handle(channel, async (event, payload) => h(event, payload));
  };

  register(CH.WORKSPACE_LIST, (e, p) => ws.list(e, p));
  register(CH.WORKSPACE_ADD, (e, p) => ws.add(e, p));
  register(CH.WORKSPACE_UPDATE, (e, p) => ws.update(e, p));
  register(CH.WORKSPACE_REMOVE, (e, p) => ws.remove(e, p));
  register(CH.WORKSPACE_REORDER, (e, p) => ws.reorder(e, p));
  register(CH.TAB_OPEN, (e, p) => tabs.open(e, p));
  register(CH.TAB_CLOSE, (e, p) => tabs.close(e, p));
  register(CH.TAB_FOCUS, (e, p) => tabs.focus(e, p));
  register(CH.TAB_RELOAD, (e, p) => tabs.reload(e, p));
  register(CH.WINDOW_SET_ACTIVE_WORKSPACE, (e, p) => wins.setActiveWorkspace(e, p));
  register(CH.WINDOW_RELOAD_SHELL, (e, p) => wins.reloadShell(e, p));
  register(CH.WINDOW_SET_PAD_VIEWS_HIDDEN, (e, p) => wins.setPadViewsHidden(e, p));
  register(CH.SETTINGS_GET, (e, p) => setts.get(e, p));
  register(CH.SETTINGS_UPDATE, (e, p) => setts.update(e, p));
  register(CH.GET_INITIAL_STATE, (e, p) => state.getInitial(e, p));
  register(CH.PAD_HISTORY_LIST, (e, p) => hist.list(e, p));
  register(CH.PAD_HISTORY_PIN, (e, p) => hist.pin(e, p));
  register(CH.PAD_HISTORY_UNPIN, (e, p) => hist.unpin(e, p));
  register(CH.PAD_HISTORY_CLEAR_RECENT, (e, p) => hist.clearRecent(e, p));
  register(CH.PAD_HISTORY_CLEAR_ALL, (e, p) => hist.clearAll(e, p));

  ipcMain.handle('httpLogin.respond', async (_e, payload: { requestId: string; cancel?: boolean; username?: string; password?: string }) => {
    const cb = pendingHttpLogins.get(payload.requestId);
    if (cb) {
      pendingHttpLogins.delete(payload.requestId);
      cb({
        requestId: payload.requestId,
        cancel: payload.cancel ?? false,
        ...(payload.username !== undefined ? { username: payload.username } : {}),
        ...(payload.password !== undefined ? { password: payload.password } : {}),
      });
    }
    return { ok: true };
  });

  const requestHttpLogin = (host: string, realm?: string) =>
    new Promise<{ cancel: boolean; username?: string; password?: string; requestId: string }>((resolve) => {
      const requestId = randomUUID();
      pendingHttpLogins.set(requestId, resolve);
      broadcastShell(CH.EV_HTTP_LOGIN_REQUEST, { requestId, url: host, realm });
    });

  void BrowserWindow; // keep import alive for typing
  return { broadcastShell, emitTabsChanged, emitTabState, requestHttpLogin };
}
