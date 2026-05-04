import { app, Menu, protocol, shell } from 'electron';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { paths } from '../storage/paths.js';
import { configureLogging, getLogger } from '../logging/logger.js';
import { registerEtherpadAppScheme } from './protocol.js';
import { buildMenuTemplate } from './menu.js';
import { WorkspaceStore } from '../workspaces/workspace-store.js';
import { PadHistoryStore } from '../pads/pad-history-store.js';
import { SettingsStore } from '../settings/settings-store.js';
import { WindowStateStore } from '../state/window-state-store.js';
import { AppWindow } from '../windows/app-window.js';
import { WindowManager } from '../windows/window-manager.js';
import { registerIpc } from '../ipc/handlers.js';

export type AppContext = {
  windowManager: WindowManager<AppWindow>;
  workspaces: WorkspaceStore;
  padHistory: PadHistoryStore;
  settings: SettingsStore;
  windowState: WindowStateStore;
  paths: ReturnType<typeof paths>;
  preloadPath: string;
  rendererUrl: string | null;
  rendererFile: string;
};

export async function boot(): Promise<void> {
  const userDataArg = process.argv.find((a) => a.startsWith('--user-data-dir='));
  if (userDataArg) {
    app.setPath('userData', userDataArg.slice('--user-data-dir='.length));
  }

  const lock = app.requestSingleInstanceLock();
  if (!lock) {
    app.quit();
    return;
  }

  registerEtherpadAppScheme(protocol);

  const userData = app.getPath('userData');
  mkdirSync(userData, { recursive: true });
  const ps = paths(userData);
  mkdirSync(ps.padCacheDir, { recursive: true });
  await configureLogging(ps.logsDir);
  const log = await getLogger('lifecycle');

  await app.whenReady();

  const workspaces = new WorkspaceStore(ps.workspacesFile);
  const padHistory = new PadHistoryStore(ps.padHistoryFile);
  const settings = new SettingsStore(ps.settingsFile);
  const windowState = new WindowStateStore(ps.windowStateFile);

  const preloadPath = join(__dirname, '../preload/index.cjs');
  const rendererUrl = process.env.ELECTRON_RENDERER_URL ?? null;
  const rendererFile = join(__dirname, '../renderer/index.html');

  let ipc: ReturnType<typeof registerIpc> | undefined;

  const windowManager = new WindowManager<AppWindow>({
    factory: (opts) => {
      const win: AppWindow = new AppWindow({
        bounds: opts.bounds ?? defaultBounds(),
        preloadPath,
        rendererUrl,
        rendererFile,
        onTabsChanged: () => {
          ipc?.emitTabsChanged();
        },
        onTabState: (s) => {
          ipc?.emitTabState(win, s);
        },
      });
      return win;
    },
  });

  const ctx: AppContext = {
    windowManager,
    workspaces,
    padHistory,
    settings,
    windowState,
    paths: ps,
    preloadPath,
    rendererUrl,
    rendererFile,
  };

  ipc = registerIpc(ctx);

  // Restore saved layout, or open a fresh window.
  const saved = windowState.read();
  if (saved.windows.length === 0) {
    windowManager.create({ bounds: defaultBounds() });
  } else {
    for (const ws of saved.windows) {
      const win = windowManager.create({ bounds: ws.bounds });
      win.tabManager.setActiveWorkspace(ws.activeWorkspaceId);
      const activeTabs = ws.openTabs.filter((t) => t.workspaceId === ws.activeWorkspaceId);
      for (const t of activeTabs) {
        const wsObj = workspaces.byId(t.workspaceId);
        if (!wsObj) continue;
        await win.tabManager.open({
          workspaceId: t.workspaceId,
          padName: t.padName,
          src: `${wsObj.serverUrl}/p/${encodeURIComponent(t.padName)}`,
        });
      }
    }
  }

  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      buildMenuTemplate({
        newTab: () => ipc?.broadcastShell('menu.newTab'),
        openPad: () => ipc?.broadcastShell('menu.openPad'),
        reload: () => ipc?.broadcastShell('menu.reload'),
        settings: () => ipc?.broadcastShell('menu.settings'),
        quit: () => app.quit(),
        about: () => ipc?.broadcastShell('menu.about'),
        openLogs: () => void shell.openPath(ps.logsDir),
      }),
    ),
  );

  app.on('second-instance', () => {
    const wins = windowManager.list();
    if (wins.length > 0) {
      wins[0]!.window.focus();
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    if (!settings.get().rememberOpenTabsOnQuit) {
      windowState.save({ schemaVersion: 1, windows: [] });
      return;
    }
    const wins = windowManager.list();
    windowState.save({
      schemaVersion: 1,
      windows: wins.map((w) => ({
        bounds: w.bounds(),
        activeWorkspaceId: null, // TabManager doesn't expose activeWorkspaceId; track via context if needed in M7
        openTabs: w.tabManager.listAll().map((t) => ({ workspaceId: t.workspaceId, padName: t.padName })),
        activeTabIndex: 0,
      })),
    });
  });

  app.on('login', (event, _wc, _details, authInfo, callback) => {
    event.preventDefault();
    void ipc
      ?.requestHttpLogin(authInfo.host, authInfo.realm)
      .then((resp) => {
        if (resp.cancel || !resp.username) callback();
        else callback(resp.username, resp.password ?? '');
      })
      .catch(() => callback());
  });

  app.on('certificate-error', (event, _wc, _url, _err, _cert, callback) => {
    event.preventDefault();
    callback(false);
  });

  log.info('app ready');
}

function defaultBounds() {
  return { x: 100, y: 100, width: 1280, height: 800 };
}
