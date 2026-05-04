import type { MenuItemConstructorOptions } from 'electron';

export type MenuCallbacks = {
  newTab: () => void;
  openPad: () => void;
  reload: () => void;
  settings: () => void;
  quit: () => void;
  about: () => void;
  openLogs: () => void;
};

export function buildMenuTemplate(cb: MenuCallbacks): MenuItemConstructorOptions[] {
  return [
    {
      label: 'File',
      submenu: [
        { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: () => cb.newTab() },
        { label: 'Open Pad…', accelerator: 'CmdOrCtrl+O', click: () => cb.openPad() },
        { type: 'separator' },
        { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: () => cb.settings() },
        { type: 'separator' },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', role: 'close' },
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
        { label: 'Reload Pad', accelerator: 'CmdOrCtrl+R', click: () => cb.reload() },
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
