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
    h.shell.getByRole('button', { name: new RegExp(`open workspace ${name}`, 'i') }),
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

test('File > New Tab opens OpenPadDialog', async () => {
  const h = await launchApp();
  try {
    await setupWorkspace(h, 'MenuNewTab');
    const ok = await clickFileMenuItem(h, 'New Tab');
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
