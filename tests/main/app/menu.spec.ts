import { describe, it, expect, vi } from 'vitest';
import { buildMenuTemplate, computeMenuEnabled, applyMenuEnabledState, MENU_IDS } from '../../../src/main/app/menu';
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

  it('reload-able items have stable IDs for runtime enable/disable', () => {
    const t = buildMenuTemplate(makeCallbacks());
    const file = getSubmenu(t, 'File') as Array<MenuItem & { id?: string }>;
    const view = getSubmenu(t, 'View') as Array<MenuItem & { id?: string }>;
    expect(file.find((m) => m.label === 'New Tab')?.id).toBe(MENU_IDS.newTab);
    expect(file.find((m) => m.label === 'Open Pad…')?.id).toBe(MENU_IDS.openPad);
    expect(file.find((m) => m.label === 'Close Tab')?.id).toBe(MENU_IDS.closeTab);
    expect(view.find((m) => m.label === 'Reload Pad')?.id).toBe(MENU_IDS.reload);
  });
});

describe('computeMenuEnabled', () => {
  it('disables newTab/openPad when no active workspace', () => {
    const r = computeMenuEnabled({ hasActiveWorkspace: false, hasActiveTab: false });
    expect(r.newTab).toBe(false);
    expect(r.openPad).toBe(false);
  });

  it('enables newTab/openPad when there is an active workspace', () => {
    const r = computeMenuEnabled({ hasActiveWorkspace: true, hasActiveTab: false });
    expect(r.newTab).toBe(true);
    expect(r.openPad).toBe(true);
  });

  it('disables closeTab and reload when no active tab', () => {
    const r = computeMenuEnabled({ hasActiveWorkspace: true, hasActiveTab: false });
    expect(r.closeTab).toBe(false);
    expect(r.reload).toBe(false);
  });

  it('enables closeTab and reload when a tab is active', () => {
    const r = computeMenuEnabled({ hasActiveWorkspace: true, hasActiveTab: true });
    expect(r.closeTab).toBe(true);
    expect(r.reload).toBe(true);
  });

  it('all four items disabled at first launch (no workspaces, no tabs)', () => {
    const r = computeMenuEnabled({ hasActiveWorkspace: false, hasActiveTab: false });
    expect(Object.values(r).every((v) => v === false)).toBe(true);
  });
});

describe('applyMenuEnabledState', () => {
  it('null menu is a no-op (does not throw)', () => {
    expect(() => applyMenuEnabledState(null, { hasActiveWorkspace: false, hasActiveTab: false })).not.toThrow();
  });

  it('writes computed enabled state onto items resolved by id', () => {
    const items: Record<string, { id: string; enabled: boolean }> = {};
    for (const id of Object.values(MENU_IDS)) items[id] = { id, enabled: true };
    const fakeMenu = {
      getMenuItemById: (id: string) => items[id] ?? null,
    };
    applyMenuEnabledState(fakeMenu as never, { hasActiveWorkspace: false, hasActiveTab: false });
    for (const id of Object.values(MENU_IDS)) expect(items[id]!.enabled).toBe(false);

    applyMenuEnabledState(fakeMenu as never, { hasActiveWorkspace: true, hasActiveTab: true });
    for (const id of Object.values(MENU_IDS)) expect(items[id]!.enabled).toBe(true);
  });

  it('tolerates missing menu items (returns null)', () => {
    const fakeMenu = { getMenuItemById: () => null };
    expect(() => applyMenuEnabledState(fakeMenu as never, { hasActiveWorkspace: true, hasActiveTab: true })).not.toThrow();
  });
});
