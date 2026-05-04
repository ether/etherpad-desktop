import { app, dialog, Menu, protocol, shell } from 'electron';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { paths } from '../storage/paths.js';
import { configureLogging, getLogger } from '../logging/logger.js';
import { registerEtherpadAppScheme } from './protocol.js';
import { buildMenuTemplate, applyMenuEnabledState } from './menu.js';
import { setupTray } from './tray.js';
import { WorkspaceStore } from '../workspaces/workspace-store.js';
import { PadHistoryStore } from '../pads/pad-history-store.js';
import { SettingsStore } from '../settings/settings-store.js';
import { WindowStateStore } from '../state/window-state-store.js';
import { AppWindow } from '../windows/app-window.js';
import { WindowManager } from '../windows/window-manager.js';
import { registerIpc } from '../ipc/handlers.js';
import { serializeWindowsForQuit } from './quit-state.js';
import { createUpdater } from './updater.js';
import type { UpdaterController } from './updater.js';
import { createEmbeddedServer } from '../embedded/embedded-server.js';
import type { EmbeddedServerController } from '../embedded/embedded-server.js';
import { CH } from '@shared/ipc/channel-names.js';

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
  /** Called by settings handlers after minimizeToTray changes, so the tray follows. */
  onMinimizeToTrayChanged?: (enabled: boolean) => void;
  /**
   * Called whenever something that affects the contextual menu state changes
   * (active workspace, active tab). The lifecycle wires this to refresh the
   * native menu's enabled/disabled state.
   */
  onMenuStateMayHaveChanged?: () => void;
  /** Auto-updater controller — undefined until boot() completes wiring. */
  updater?: UpdaterController;
  /** Embedded Etherpad server controller — present when any workspace has kind: 'embedded'. */
  embeddedServer?: EmbeddedServerController;
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

  const ipcRef: { current: ReturnType<typeof registerIpc> | undefined } = { current: undefined };

  // allowQuit is set to true in the before-quit handler so close handlers stop
  // intercepting once a real quit is in progress.
  let allowQuit = false;

  const trayIconPath = join(__dirname, '../../build/icons/icon-32.png');

  const windowManager = new WindowManager<AppWindow>({
    factory: (opts) => {
      const win: AppWindow = new AppWindow({
        bounds: opts.bounds ?? defaultBounds(),
        preloadPath,
        rendererUrl,
        rendererFile,
        onTabsChanged: () => {
          ipcRef.current?.emitTabsChanged();
        },
        onTabState: (s) => {
          ipcRef.current?.emitTabState(win, s);
        },
        onClosed: () => {
          windowManager.forget(win);
        },
        getMinimizeToTray: () => settings.get().minimizeToTray && !allowQuit,
      });

      const crashTimes: number[] = [];
      win.shellView.webContents.on('render-process-gone', () => {
        const now = Date.now();
        crashTimes.push(now);
        while (crashTimes.length > 0 && (now - crashTimes[0]!) > 60_000) crashTimes.shift();
        if (crashTimes.length > 3) {
          log.error('shell crashed >3 times in 60s — giving up');
          dialog.showErrorBox(
            'Etherpad Desktop',
            'The interface keeps crashing. Please restart the app, and if this persists, file an issue.',
          );
          app.quit();
          return;
        }
        log.warn('shell crashed; reloading');
        win.shellView.webContents.reload();
      });

      return win;
    },
  });

  const embeddedServer = createEmbeddedServer({
    log,
    userDataDir: userData,
  });

  // If any persisted workspace is `kind: 'embedded'`, eagerly start the
  // server so it's ready when the user clicks one. Otherwise stay idle.
  const hasEmbedded = workspaces.list().some((w) => w.kind === 'embedded');
  if (hasEmbedded) {
    void embeddedServer.start().catch((e) => {
      log.warn('failed to start embedded server on boot', { message: (e as Error).message });
    });
  }

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
    embeddedServer,
  };

  const tray = setupTray({
    iconPath: trayIconPath,
    onShow: () => {
      const wins = windowManager.list().filter((w) => !w.window.isDestroyed());
      let target = wins[0];
      if (!target) {
        target = windowManager.create({ bounds: defaultBounds() });
      }
      target.window.show();
      target.window.focus();
    },
    onQuit: () => {
      allowQuit = true;
      app.quit();
    },
  });

  // Pass the tray sync callback into the context so settings handlers can call it.
  ctx.onMinimizeToTrayChanged = (enabled: boolean) => tray.setEnabled(enabled);

  // Set up the auto-updater and broadcast state changes to all shell views.
  const updater = await createUpdater({ log });
  ctx.updater = updater;
  updater.onStateChange((s) => {
    ipcRef.current?.broadcastShell(CH.EV_UPDATER_STATE, s);
  });

  ipcRef.current = registerIpc(ctx);

  tray.setEnabled(settings.get().minimizeToTray);

  // Start auto-checking: on boot + every 6 hours.
  updater.startAutoCheck(6 * 60 * 60 * 1000);

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

  const appMenu = Menu.buildFromTemplate(
    buildMenuTemplate({
      newTab: () => ipcRef.current?.broadcastShell('menu.newTab'),
      openPad: () => ipcRef.current?.broadcastShell('menu.openPad'),
      reload: () => ipcRef.current?.broadcastShell('menu.reload'),
      settings: () => ipcRef.current?.broadcastShell('menu.settings'),
      quit: () => app.quit(),
      about: () => ipcRef.current?.broadcastShell('menu.about'),
      openLogs: () => void shell.openPath(ps.logsDir),
      quickSwitcher: () => ipcRef.current?.broadcastShell('menu.quickSwitcher'),
    }),
  );
  Menu.setApplicationMenu(appMenu);

  /** Recompute menu item enabled state from the current windows' active tabs. */
  const refreshMenuEnabledState = () => {
    const wins = windowManager.list().filter((w) => !w.window.isDestroyed());
    // For app-level menu, "active tab" is true if ANY window has one — the
    // shortcuts target the focused window, but the menu is global.
    const hasActiveWorkspace = wins.some((w) => w.tabManager.getActiveWorkspaceId() !== null);
    const hasActiveTab = wins.some((w) => w.tabManager.getActiveTabId() !== null);
    applyMenuEnabledState(appMenu, { hasActiveWorkspace, hasActiveTab });
  };

  // Wire the menu refresh into the AppContext so workspace/tab/active-workspace
  // mutations all trigger it. (Patching ipcRef.current.emitTabsChanged from
  // here would miss direct deps captures inside individual IPC handler
  // factories.)
  ctx.onMenuStateMayHaveChanged = refreshMenuEnabledState;
  refreshMenuEnabledState();

  app.on('second-instance', () => {
    const wins = windowManager.list();
    if (wins.length > 0) {
      wins[0]!.window.focus();
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform === 'darwin') return;
    // When minimizeToTray is on, all windows hiding via the close button is expected;
    // the tray keeps the app alive. Only quit when the tray's "Quit" action fires.
    if (settings.get().minimizeToTray) return;
    app.quit();
  });

  app.on('before-quit', () => {
    allowQuit = true;
    tray.destroy();
    updater.stop();
    // Best-effort — don't await; quit shouldn't block on server shutdown.
    void embeddedServer.stop().catch(() => { /* ignore */ });
    try {
      if (!settings.get().rememberOpenTabsOnQuit) {
        windowState.save({ schemaVersion: 1, windows: [] });
        return;
      }
      windowState.save(serializeWindowsForQuit(windowManager.list()));
    } catch (e) {
      // Best-effort persistence — never block quit on a save error or a
      // destroyed-window access. Logged so we can spot regressions.
      log.warn('failed to persist window state on quit', { message: (e as Error).message });
    }
  });

  app.on('login', (event, _wc, _details, authInfo, callback) => {
    event.preventDefault();
    void ipcRef.current
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
