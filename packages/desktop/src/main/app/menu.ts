import type { Menu, MenuItemConstructorOptions } from 'electron';

export type MenuCallbacks = {
  newTab: () => void;
  openPad: () => void;
  openByUrl: () => void;
  closeTab: () => void;
  reload: () => void;
  hardReload: () => void;
  settings: () => void;
  quit: () => void;
  about: () => void;
  openLogs: () => void;
  quickSwitcher: () => void;
  newWorkspace: () => void;
};

/** IDs used to locate items for dynamic enable/disable. */
export const MENU_IDS = {
  newWorkspace: 'menu.newWorkspace',
  newTab: 'menu.newTab',
  openPad: 'menu.openPad',
  openByUrl: 'menu.openByUrl',
  closeTab: 'menu.closeTab',
  reload: 'menu.reload',
  hardReload: 'menu.hardReload',
} as const;

export function buildMenuTemplate(cb: MenuCallbacks): MenuItemConstructorOptions[] {
  return [
    {
      label: 'File',
      submenu: [
        { id: MENU_IDS.newWorkspace, label: 'New Etherpad Server…', accelerator: 'CmdOrCtrl+Shift+N', click: () => cb.newWorkspace() },
        { type: 'separator' },
        { id: MENU_IDS.newTab, label: 'New Pad', accelerator: 'CmdOrCtrl+T', click: () => cb.newTab() },
        { id: MENU_IDS.openPad, label: 'Open Pad…', accelerator: 'CmdOrCtrl+O', click: () => cb.openPad() },
        // "Open Pad by URL…" — paste an Etherpad pad URL and we add the
        // instance + open the pad in one step. Ctrl+L follows the browser
        // address-bar convention.
        { id: MENU_IDS.openByUrl, label: 'Open Pad by URL…', accelerator: 'CmdOrCtrl+L', click: () => cb.openByUrl() },
        { type: 'separator' },
        { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: () => cb.settings() },
        { type: 'separator' },
        // Close the active PAD (tab), NOT the window. Using `role: 'close'` here
        // closes the BaseWindow which on Linux triggers `window-all-closed`
        // and quits the whole app — definitely not what File > Close Pad
        // should do.
        { id: MENU_IDS.closeTab, label: 'Close Pad', accelerator: 'CmdOrCtrl+W', click: () => cb.closeTab() },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => cb.quit() },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { id: MENU_IDS.reload, label: 'Reload Pad', accelerator: 'CmdOrCtrl+R', click: () => cb.reload() },
        // Bypass HTTP cache. Etherpad plugins (notably ep_webrtc) sometimes
        // change their JS/translation bundles between releases, and our
        // per-partition cache can serve stale ones long after the server
        // has updated. Hard reload forces a fresh fetch.
        { id: MENU_IDS.hardReload, label: 'Hard Reload Pad', accelerator: 'CmdOrCtrl+Shift+R', click: () => cb.hardReload() },
        { type: 'separator' },
        { label: 'Quick Switcher…', accelerator: 'CmdOrCtrl+K', click: () => cb.quickSwitcher() },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close' }],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'About Etherpad Desktop', click: () => cb.about() },
        { label: 'Open Log Folder', click: () => cb.openLogs() },
      ],
    },
  ];
}

/** State the menu items react to. */
export type MenuContext = {
  hasActiveWorkspace: boolean;
  hasActiveTab: boolean;
};

/**
 * Compute which menu items should be enabled given the current app state.
 * Pure function — no Electron dependency — so it can be unit tested.
 */
export function computeMenuEnabled(ctx: MenuContext): Record<keyof typeof MENU_IDS, boolean> {
  return {
    // Adding a new workspace is always possible.
    newWorkspace: true,
    // Opening a pad needs a workspace to put it in.
    newTab: ctx.hasActiveWorkspace,
    openPad: ctx.hasActiveWorkspace,
    // Closing the active tab only makes sense if one is open.
    closeTab: ctx.hasActiveTab,
    // Reload only makes sense if there's a pad to reload.
    reload: ctx.hasActiveTab,
    hardReload: ctx.hasActiveTab,
    // Open by URL is always possible — it adds an instance if needed.
    openByUrl: true,
  };
}

/**
 * Apply the computed enabled state to an Electron Menu. Looks up items by
 * their stable IDs from MENU_IDS.
 */
export function applyMenuEnabledState(menu: Menu | null, ctx: MenuContext): void {
  if (!menu) return;
  const enabled = computeMenuEnabled(ctx);
  for (const [key, id] of Object.entries(MENU_IDS) as [keyof typeof MENU_IDS, string][]) {
    const item = menu.getMenuItemById(id);
    if (item) item.enabled = enabled[key];
  }
}
