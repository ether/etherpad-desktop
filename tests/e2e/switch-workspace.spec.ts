import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch.js';

test('switching workspace hides the previous workspace tabs and shows new workspace tabs', async () => {
  const h = await launchApp();
  try {
    // Add two workspaces (both pointing at the same fixture, different names).
    for (const name of ['Alpha', 'Beta']) {
      const isFirst = name === 'Alpha';
      if (!isFirst) {
        await h.shell.getByRole('button', { name: /add workspace/i }).click();
      }
      await h.shell.getByLabel(/name/i).fill(name);
      await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
      await h.shell.getByRole('button', { name: /^add$/i }).click();
      await expect(h.shell.getByRole('button', { name: new RegExp(`open workspace ${name}`, 'i') })).toBeVisible();
    }

    // Open a tab in Beta (last-added is active)
    await h.shell.getByRole('button', { name: /new pad/i }).click();
    await h.shell.getByLabel(/pad name/i).fill('beta-pad');
    await h.shell.getByRole('button', { name: /^open$/i }).click();
    await expect(h.shell.getByRole('tab', { name: /beta-pad/ })).toBeVisible();

    // Switch to Alpha — beta-pad tab should disappear from the strip.
    await h.shell.getByRole('button', { name: /open workspace alpha/i }).click();
    await expect(h.shell.getByRole('tab', { name: /beta-pad/ })).toHaveCount(0);

    // Switch back — beta-pad reappears.
    await h.shell.getByRole('button', { name: /open workspace beta/i }).click();
    await expect(h.shell.getByRole('tab', { name: /beta-pad/ })).toBeVisible();
  } finally {
    await h.close();
  }
});
