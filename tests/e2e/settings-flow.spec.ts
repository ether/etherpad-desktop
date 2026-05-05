import { test, expect } from '@playwright/test';
import { rmSync } from 'node:fs';
import { launchApp } from './fixtures/launch.js';

type AppHandle = Awaited<ReturnType<typeof launchApp>>;

async function setupOneWorkspace(h: AppHandle, name: string) {
  await h.shell.getByLabel(/name/i).fill(name);
  await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
  await h.shell.getByRole('button', { name: /^add$/i }).click();
  await expect(h.shell.getByRole('button', { name: new RegExp(`open instance ${name}`, 'i') })).toBeVisible();
}

async function openPad(h: AppHandle, name: string) {
  await h.shell.getByRole('button', { name: /new pad/i }).click();
  await h.shell.getByLabel(/pad name/i).fill(name);
  await h.shell.getByRole('button', { name: /^open$/i }).click();
  await expect(h.shell.getByRole('tab', { name: new RegExp(name) })).toBeVisible();
}

test('open Settings dialog from rail cog', async () => {
  const h = await launchApp();
  try {
    await setupOneWorkspace(h, 'Cog');

    // Click the cog/settings button in the rail
    await h.shell.getByRole('button', { name: /^settings$/i }).click();

    // Settings dialog should be visible with its heading
    await expect(h.shell.getByRole('dialog')).toBeVisible();
    await expect(h.shell.getByRole('heading', { name: /^settings$/i })).toBeVisible();
  } finally {
    await h.close();
  }
});

test('change default zoom + save persists across relaunch', async () => {
  const h1 = await launchApp();
  await setupOneWorkspace(h1, 'ZoomTest');

  // Open settings
  await h1.shell.getByRole('button', { name: /^settings$/i }).click();
  await expect(h1.shell.getByRole('heading', { name: /^settings$/i })).toBeVisible();

  // Change zoom to 1.5
  const zoomInput = h1.shell.getByLabel(/default zoom/i);
  await zoomInput.fill('1.5');

  // Save
  await h1.shell.getByRole('button', { name: /^save$/i }).click();
  // Dialog should close after save
  await expect(h1.shell.getByRole('dialog')).toHaveCount(0);

  const userDataDir = h1.userDataDir;
  await h1.app.close();

  // Relaunch with same userDataDir
  const h2 = await launchApp({ userDataDir });
  try {
    await expect(h2.shell.getByRole('button', { name: /open instance zoomtest/i })).toBeVisible();

    // Open settings again and verify zoom persisted
    await h2.shell.getByRole('button', { name: /^settings$/i }).click();
    await expect(h2.shell.getByRole('heading', { name: /^settings$/i })).toBeVisible();

    const zoomInputRelaunched = h2.shell.getByLabel(/default zoom/i);
    await expect(zoomInputRelaunched).toHaveValue('1.5');
  } finally {
    await h2.app.close();
    rmSync(userDataDir, { recursive: true, force: true });
  }
});

test('Settings → Remove workspace shows RemoveWorkspaceDialog', async () => {
  const h = await launchApp();
  try {
    await setupOneWorkspace(h, 'ToRemove');

    // Open settings
    await h.shell.getByRole('button', { name: /^settings$/i }).click();
    await expect(h.shell.getByRole('heading', { name: /^settings$/i })).toBeVisible();

    // Click the Remove button for the workspace listed in Settings
    await h.shell.getByRole('button', { name: /^remove$/i }).click();

    // RemoveWorkspaceDialog should be visible
    await expect(h.shell.getByRole('heading', { name: /remove this etherpad instance/i })).toBeVisible();
  } finally {
    await h.close();
  }
});

test('Clear All History wipes pad history in the sidebar', async () => {
  const h = await launchApp();
  try {
    await setupOneWorkspace(h, 'HistoryWs');

    // Open a pad to generate history
    await openPad(h, 'hist-pad-1');

    // Confirm the pad appears in the sidebar recent list
    // Use class-scoped selector to avoid matching the pin button (aria-label="Pin hist-pad-1")
    await expect(h.shell.locator('.pad-open', { hasText: 'hist-pad-1' })).toBeVisible();

    // Open settings and clear all history
    await h.shell.getByRole('button', { name: /^settings$/i }).click();
    await expect(h.shell.getByRole('heading', { name: /^settings$/i })).toBeVisible();

    await h.shell.getByRole('button', { name: /clear all pad history/i }).click();

    // Close settings
    await h.shell.getByRole('button', { name: /^cancel$/i }).click();
    await expect(h.shell.getByRole('dialog')).toHaveCount(0);

    // Sidebar should no longer show the pad in recent (neither open nor pin button)
    await expect(h.shell.locator('.pad-open', { hasText: 'hist-pad-1' })).toHaveCount(0);
  } finally {
    await h.close();
  }
});
