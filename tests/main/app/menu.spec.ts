import { describe, it, expect, vi } from 'vitest';
import { buildMenuTemplate } from '../../../src/main/app/menu';
import type { MenuItemConstructorOptions } from 'electron';

type MenuItem = { label?: string; role?: string; click?: () => void; accelerator?: string; type?: string };

function makeCallbacks() {
  return {
    newTab: vi.fn(),
    openPad: vi.fn(),
    reload: vi.fn(),
    settings: vi.fn(),
    quit: vi.fn(),
    about: vi.fn(),
    openLogs: vi.fn(),
  };
}

function getSubmenu(template: MenuItemConstructorOptions[], label: string): MenuItem[] {
  const top = template.find((m) => m.label === label);
  return (top?.submenu as MenuItem[]) ?? [];
}

function clickItem(items: MenuItem[], label: string) {
  const item = items.find((m) => m.label === label);
  if (!item) throw new Error(`Menu item "${label}" not found`);
  item.click!();
}

describe('buildMenuTemplate', () => {
  it('contains File / Edit / View / Window / Help submenus', () => {
    const t = buildMenuTemplate(makeCallbacks());
    expect(t.map((m) => m.label)).toEqual(['File', 'Edit', 'View', 'Window', 'Help']);
  });

  it('File menu has New Tab, Open Pad, Settings, Quit accelerators', () => {
    const t = buildMenuTemplate(makeCallbacks());
    const items = getSubmenu(t, 'File');
    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'New Tab', accelerator: 'CmdOrCtrl+T' }),
      expect.objectContaining({ label: 'Open Pad…', accelerator: 'CmdOrCtrl+O' }),
      expect.objectContaining({ label: 'Settings', accelerator: 'CmdOrCtrl+,' }),
      expect.objectContaining({ label: 'Quit', accelerator: 'CmdOrCtrl+Q' }),
    ]));
  });

  // --- callback wiring tests ---

  it('File > New Tab click → cb.newTab()', () => {
    const cb = makeCallbacks();
    clickItem(getSubmenu(buildMenuTemplate(cb), 'File'), 'New Tab');
    expect(cb.newTab).toHaveBeenCalledTimes(1);
  });

  it('File > Open Pad… click → cb.openPad()', () => {
    const cb = makeCallbacks();
    clickItem(getSubmenu(buildMenuTemplate(cb), 'File'), 'Open Pad…');
    expect(cb.openPad).toHaveBeenCalledTimes(1);
  });

  it('File > Settings click → cb.settings()', () => {
    const cb = makeCallbacks();
    clickItem(getSubmenu(buildMenuTemplate(cb), 'File'), 'Settings');
    expect(cb.settings).toHaveBeenCalledTimes(1);
  });

  it('File > Quit click → cb.quit()', () => {
    const cb = makeCallbacks();
    clickItem(getSubmenu(buildMenuTemplate(cb), 'File'), 'Quit');
    expect(cb.quit).toHaveBeenCalledTimes(1);
  });

  it('View > Reload Pad click → cb.reload()', () => {
    const cb = makeCallbacks();
    clickItem(getSubmenu(buildMenuTemplate(cb), 'View'), 'Reload Pad');
    expect(cb.reload).toHaveBeenCalledTimes(1);
  });

  it('View > Reload Pad has CmdOrCtrl+R accelerator', () => {
    const t = buildMenuTemplate(makeCallbacks());
    const items = getSubmenu(t, 'View');
    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Reload Pad', accelerator: 'CmdOrCtrl+R' }),
    ]));
  });

  it('Help > About Etherpad Desktop click → cb.about()', () => {
    const cb = makeCallbacks();
    clickItem(getSubmenu(buildMenuTemplate(cb), 'Help'), 'About Etherpad Desktop');
    expect(cb.about).toHaveBeenCalledTimes(1);
  });

  it('Help > Open Log Folder click → cb.openLogs()', () => {
    const cb = makeCallbacks();
    clickItem(getSubmenu(buildMenuTemplate(cb), 'Help'), 'Open Log Folder');
    expect(cb.openLogs).toHaveBeenCalledTimes(1);
  });

  // --- role-based items exist (no click, but role is set) ---

  it('Edit menu has undo/redo/cut/copy/paste/selectAll roles', () => {
    const t = buildMenuTemplate(makeCallbacks());
    const roles = getSubmenu(t, 'Edit').map((m) => m.role).filter(Boolean);
    expect(roles).toEqual(expect.arrayContaining(['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll']));
  });

  it('View menu has resetZoom/zoomIn/zoomOut/togglefullscreen roles', () => {
    const t = buildMenuTemplate(makeCallbacks());
    const roles = getSubmenu(t, 'View').map((m) => m.role).filter(Boolean);
    expect(roles).toEqual(expect.arrayContaining(['resetZoom', 'zoomIn', 'zoomOut', 'togglefullscreen']));
  });

  it('Window menu has minimize and close roles', () => {
    const t = buildMenuTemplate(makeCallbacks());
    const roles = getSubmenu(t, 'Window').map((m) => m.role).filter(Boolean);
    expect(roles).toEqual(expect.arrayContaining(['minimize', 'close']));
  });

  it('File > Close Tab has role=close', () => {
    const t = buildMenuTemplate(makeCallbacks());
    const closeTab = getSubmenu(t, 'File').find((m) => m.label === 'Close Tab');
    expect(closeTab?.role).toBe('close');
  });
});
