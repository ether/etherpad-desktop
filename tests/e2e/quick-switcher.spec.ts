/**
 * quick-switcher.spec.ts
 *
 * Tests that the View > Quick Switcher… menu entry opens the quick
 * switcher dialog, and that selecting a pad result from another workspace
 * switches to that workspace and opens the pad.
 */
import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch.js';
import type { AppHandle } from './fixtures/launch.js';

async function setupWorkspace(h: AppHandle, name: string) {
  await h.shell.getByLabel(/name/i).fill(name);
  await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
  await h.shell.getByRole('button', { name: /^add$/i }).click();
  await expect(
    h.shell.getByRole('button', { name: new RegExp(`open workspace ${name}`, 'i') }),
  ).toBeVisible();
}

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

test('View > Quick Switcher… menu item opens the quick switcher dialog', async () => {
  const h = await launchApp();
  try {
    await setupWorkspace(h, 'QsMenu');
    const ok = await clickViewMenuItem(h, 'Quick Switcher…');
    expect(ok).toBe(true);
    await expect(h.shell.getByRole('dialog', { name: /quick switcher/i })).toBeVisible();
    // Escape closes it
    await h.shell.getByRole('textbox', { name: /quick switcher search input/i }).press('Escape');
    await expect(h.shell.getByRole('dialog', { name: /quick switcher/i })).toHaveCount(0);
  } finally {
    await h.close();
  }
});

test('Ctrl+K equivalent (menu.quickSwitcher broadcast) opens quick switcher', async () => {
  const h = await launchApp();
  try {
    await setupWorkspace(h, 'QsKeybd');

    // Trigger via the same broadcast path the keyboard shortcut uses
    await h.app.evaluate(({ webContents }) => {
      for (const wc of webContents.getAllWebContents()) {
        const url = wc.getURL();
        if (
          (url.startsWith('file://') || url.includes('localhost') || url.includes('127.0.0.1:')) &&
          !url.includes('/p/')
        ) {
          wc.send('menu.quickSwitcher', { kind: 'menu.quickSwitcher' });
        }
      }
    });

    await expect(h.shell.getByRole('dialog', { name: /quick switcher/i })).toBeVisible();
  } finally {
    await h.close();
  }
});

test('clicking the rail search button opens the quick switcher', async () => {
  const h = await launchApp();
  try {
    await h.shell.getByLabel(/name/i).fill('SearchTest');
    await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
    await h.shell.getByRole('button', { name: /^add$/i }).click();
    await expect(h.shell.getByRole('button', { name: /open workspace searchtest/i })).toBeVisible();

    await h.shell.getByRole('button', { name: /search workspaces and pads/i }).click();
    await expect(h.shell.getByRole('dialog', { name: /quick switcher/i })).toBeVisible();
  } finally { await h.close(); }
});

test('Quick Switcher pad selection switches workspace and opens pad', async () => {
  const h = await launchApp();
  try {
    // First workspace is set up by launchApp (the add workspace dialog is pre-filled)
    await setupWorkspace(h, 'Alpha');

    // Add second workspace
    await h.shell.getByRole('button', { name: /add workspace/i }).click();
    await setupWorkspace(h, 'Beta');

    // Open a pad in Beta workspace (which should now be active)
    await h.shell.getByRole('button', { name: /new pad/i }).click();
    await h.shell.getByLabel(/pad name/i).fill('beta-pad');
    await h.shell.getByRole('button', { name: /^open$/i }).click();
    await expect(h.shell.getByRole('tab', { name: /beta-pad/ })).toBeVisible();

    // Switch to Alpha workspace
    await h.shell.getByRole('button', { name: /open workspace alpha/i }).click();
    // beta-pad tab should not be visible in Alpha
    await expect(h.shell.getByRole('tab', { name: /beta-pad/ })).toHaveCount(0);

    // Open quick switcher via menu
    const ok = await clickViewMenuItem(h, 'Quick Switcher…');
    expect(ok).toBe(true);
    await expect(h.shell.getByRole('dialog', { name: /quick switcher/i })).toBeVisible();

    // Search for "beta-pad"
    await h.shell
      .getByRole('textbox', { name: /quick switcher search input/i })
      .fill('beta-pad');

    // Click the result
    await h.shell.getByRole('option', { name: /beta-pad/ }).first().click();

    // Dialog should close
    await expect(h.shell.getByRole('dialog', { name: /quick switcher/i })).toHaveCount(0);

    // beta-pad tab should now be visible (workspace switched + pad opened)
    await expect(h.shell.getByRole('tab', { name: /beta-pad/ })).toBeVisible();
  } finally {
    await h.close();
  }
});
