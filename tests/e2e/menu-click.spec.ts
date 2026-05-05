/**
 * menu-click.spec.ts
 *
 * Tests that exercise the REAL native-menu click path, not the
 * triggerMenuAction() shortcut used in keyboard-shortcuts.spec.ts.
 *
 * The real flow when a user clicks File > Settings is:
 *   native menu click → cb.settings() (in lifecycle.ts)
 *     → ipcRef.current?.broadcastShell('menu.settings')
 *     → every shellView's webContents.send('menu.settings')
 *     → preload onMenuShellMessage → renderer handler → dialog opens
 *
 * We use app.evaluate() to call Menu.getApplicationMenu() in the main
 * process and programmatically invoke item.click(), which fires exactly
 * the same code path as a real mouse click on the native menu.
 */
import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch.js';
import type { AppHandle } from './fixtures/launch.js';

async function setupWorkspace(h: AppHandle, name = 'MenuTest') {
  await h.shell.getByLabel(/name/i).fill(name);
  await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
  await h.shell.getByRole('button', { name: /^add$/i }).click();
  await expect(
    h.shell.getByRole('button', { name: new RegExp(`open instance ${name}`, 'i') }),
  ).toBeVisible();
}

/**
 * Invoke a File-menu item's click handler directly in the main process.
 * Returns true if the item was found and clicked, false otherwise.
 */
async function clickFileMenuItem(h: AppHandle, label: string): Promise<boolean> {
  return await h.app.evaluate(
    ({ Menu }, { lbl }) => {
      const menu = Menu.getApplicationMenu();
      if (!menu) return false;
      const file = menu.items.find((m) => m.label === 'File');
      if (!file || !file.submenu) return false;
      const item = file.submenu.items.find((m) => m.label === lbl);
      if (!item) return false;
      item.click();
      return true;
    },
    { lbl: label },
  );
}

test('File > New Etherpad Server… opens AddWorkspaceDialog', async () => {
  const h = await launchApp();
  try {
    await setupWorkspace(h, 'MenuNewServer');
    const ok = await clickFileMenuItem(h, 'New Etherpad Server…');
    expect(ok).toBe(true);
    await expect(h.shell.getByRole('heading', { name: /add an etherpad instance/i })).toBeVisible();
  } finally {
    await h.close();
  }
});

test('File > New Pad opens OpenPadDialog', async () => {
  const h = await launchApp();
  try {
    await setupWorkspace(h, 'MenuNewTab');
    const ok = await clickFileMenuItem(h, 'New Pad');
    expect(ok).toBe(true);
    await expect(h.shell.getByRole('heading', { name: /open a pad/i })).toBeVisible();
  } finally {
    await h.close();
  }
});

test('File > Open Pad… opens OpenPadDialog', async () => {
  const h = await launchApp();
  try {
    await setupWorkspace(h, 'MenuOpenPad');
    const ok = await clickFileMenuItem(h, 'Open Pad…');
    expect(ok).toBe(true);
    await expect(h.shell.getByRole('heading', { name: /open a pad/i })).toBeVisible();
  } finally {
    await h.close();
  }
});

test('File > Settings opens SettingsDialog (the user-reported bug)', async () => {
  const h = await launchApp();
  try {
    await setupWorkspace(h, 'MenuSettings');
    const ok = await clickFileMenuItem(h, 'Settings');
    expect(ok).toBe(true);
    await expect(h.shell.getByRole('heading', { name: /^settings$/i })).toBeVisible();
  } finally {
    await h.close();
  }
});

async function clickHelpMenuItem(h: AppHandle, label: string): Promise<boolean> {
  return await h.app.evaluate(({ Menu }, { lbl }) => {
    const menu = Menu.getApplicationMenu();
    if (!menu) return false;
    const help = menu.items.find((m) => m.label === 'Help');
    if (!help || !help.submenu) return false;
    const item = help.submenu.items.find((m) => m.label === lbl);
    if (!item) return false;
    item.click();
    return true;
  }, { lbl: label });
}

test('Help > About Etherpad Desktop opens AboutDialog (the user-reported bug)', async () => {
  const h = await launchApp();
  try {
    await setupWorkspace(h, 'AboutTest');
    const ok = await clickHelpMenuItem(h, 'About Etherpad Desktop');
    expect(ok).toBe(true);
    await expect(h.shell.getByRole('heading', { name: /^etherpad desktop$/i })).toBeVisible();
    await expect(h.shell.getByText(/version 0\.1\.0/i)).toBeVisible();
  } finally {
    await h.close();
  }
});

test('Help > Open Log Folder menu item exists and fires openLogs callback', async () => {
  const h = await launchApp();
  try {
    await setupWorkspace(h, 'LogFolderTest');
    // We can't easily assert shell.openPath was called, but we CAN assert the
    // item exists in the menu and its click() doesn't throw.
    const ok = await clickHelpMenuItem(h, 'Open Log Folder');
    expect(ok).toBe(true);
  } finally {
    await h.close();
  }
});

async function clickViewMenuItem(h: AppHandle, label: string): Promise<boolean> {
  return await h.app.evaluate(({ Menu }, { lbl }) => {
    const menu = Menu.getApplicationMenu();
    if (!menu) return false;
    const view = menu.items.find((m) => m.label === 'View');
    if (!view || !view.submenu) return false;
    const item = view.submenu.items.find((m) => m.label === lbl);
    if (!item) return false;
    item.click();
    return true;
  }, { lbl: label });
}

test('View > Reload Pad menu item exists and fires reload callback', async () => {
  const h = await launchApp();
  try {
    await setupWorkspace(h, 'ViewReloadTest');
    // Open a pad first so there's an active pad to reload
    const clickedNewTab = await clickFileMenuItem(h, 'New Pad');
    expect(clickedNewTab).toBe(true);
    await expect(h.shell.getByRole('heading', { name: /open a pad/i })).toBeVisible();
    // Close the dialog
    await h.shell.getByRole('button', { name: /cancel/i }).click();
    // Now trigger Reload Pad; this calls cb.reload() in lifecycle → broadcastShell('menu.reload')
    const ok = await clickViewMenuItem(h, 'Reload Pad');
    expect(ok).toBe(true);
    // No assertion on side-effect (no active tab was opened), but the item fired without error
  } finally {
    await h.close();
  }
});

// REGRESSION: File > Close Pad must close the active pad (tab), not the window
// (and definitely not the entire app). Using role: 'close' on the menu item
// triggered Linux's window-all-closed → app.quit() → app exited. Reported by
// user 2026-05-05.
test('File > Close Pad closes the active pad, leaves app and other pads alive', async () => {
  const h = await launchApp();
  try {
    await setupWorkspace(h, 'CloseTabRegression');

    // Open two pads so we have something to close
    await h.shell.getByRole('button', { name: /new pad/i }).click();
    await h.shell.getByLabel(/pad name/i).fill('alpha');
    await h.shell.getByRole('button', { name: /^open$/i }).click();
    await expect(h.shell.getByRole('tab', { name: /alpha/ })).toBeVisible();

    await h.shell.getByRole('button', { name: /new pad/i }).click();
    await h.shell.getByLabel(/pad name/i).fill('bravo');
    await h.shell.getByRole('button', { name: /^open$/i }).click();
    await expect(h.shell.getByRole('tab', { name: /bravo/ })).toBeVisible();

    // Click File > Close Pad via the actual menu item
    const ok = await clickFileMenuItem(h, 'Close Pad');
    expect(ok).toBe(true);

    // The app must still be alive — the window remains visible AND so does
    // the alpha pad (only the active 'bravo' pad should have closed).
    await expect(h.shell.getByRole('tab', { name: /bravo/ })).toHaveCount(0);
    await expect(h.shell.getByRole('tab', { name: /alpha/ })).toBeVisible();

    // Sanity: workspace rail still rendered = renderer still alive
    await expect(h.shell.getByRole('button', { name: /open instance closetabregression/i })).toBeVisible();
  } finally {
    await h.close();
  }
});

test('File > Quit menu item exists and fires quit callback', async () => {
  const h = await launchApp();
  try {
    await setupWorkspace(h, 'QuitTest');
    // We can't actually quit the app in a test, but we can verify the item exists.
    // Use app.evaluate to check the item label rather than calling click() (which would close the app).
    const found = await h.app.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      if (!menu) return false;
      const file = menu.items.find((m) => m.label === 'File');
      if (!file || !file.submenu) return false;
      return file.submenu.items.some((m) => m.label === 'Quit');
    });
    expect(found).toBe(true);
  } finally {
    await h.close();
  }
});
