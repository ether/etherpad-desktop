import { test, expect } from '@playwright/test';
import { rmSync } from 'node:fs';
import { launchApp } from './fixtures/launch.js';

test('relaunching restores workspaces, the active workspace, and open tabs', async () => {
  // First launch: add workspace + open a pad
  const h1 = await launchApp();
  await h1.shell.getByLabel(/name/i).fill('Sticky');
  await h1.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
  await h1.shell.getByRole('button', { name: /^add$/i }).click();
  await expect(h1.shell.getByRole('button', { name: /open instance sticky/i })).toBeVisible();

  await h1.shell.getByRole('button', { name: /new pad/i }).click();
  await h1.shell.getByLabel(/pad name/i).fill('survives-restart');
  await h1.shell.getByRole('button', { name: /^open$/i }).click();
  await expect(h1.shell.getByRole('tab', { name: /survives-restart/ })).toBeVisible();

  const userDataDir = h1.userDataDir;
  // Close the app without wiping userData (don't call h1.close() which runs cleanup)
  await h1.app.close();

  // Second launch with the same userDataDir
  const h2 = await launchApp({ userDataDir });
  try {
    // Workspace should be restored from disk. Cold-start on a slow CI
    // runner (xvfb + Electron + initial getInitial round-trip + render)
    // routinely takes 8–12s before the rail is interactable; the
    // default 15s expect timeout was tipping over under load. Match
    // the tab assertion's 30s headroom.
    await expect(h2.shell.getByRole('button', { name: /open instance sticky/i }))
      .toBeVisible({ timeout: 30_000 });
    // Tab should be restored via tabsChanged after setActiveWorkspace
    await expect(h2.shell.getByRole('tab', { name: /survives-restart/ })).toBeVisible({ timeout: 30_000 });
  } finally {
    await h2.app.close();
    rmSync(userDataDir, { recursive: true, force: true });
  }
});
