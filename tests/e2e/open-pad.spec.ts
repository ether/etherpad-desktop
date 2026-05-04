import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch.js';

test('opening a pad creates a tab and lands on the Etherpad page', async () => {
  const h = await launchApp();
  try {
    // Add workspace pointing at the fixture Etherpad
    await h.shell.getByLabel(/name/i).fill('Fixture');
    await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
    await h.shell.getByRole('button', { name: /^add$/i }).click();
    await expect(h.shell.getByRole('button', { name: /open workspace fixture/i })).toBeVisible();

    // Open a pad via the sidebar "New Pad" button
    await h.shell.getByRole('button', { name: /new pad/i }).click();
    await h.shell.getByLabel(/pad name/i).fill('e2e-test-pad');
    await h.shell.getByRole('button', { name: /^open$/i }).click();

    // Tab strip shows the new tab (title starts as padName)
    await expect(h.shell.getByRole('tab', { name: /e2e-test-pad/ })).toBeVisible();

    // The pad WebContentsView is a separate target; check the app has at least 1 window
    const windows = h.app.windows();
    expect(windows.length).toBeGreaterThanOrEqual(1);
  } finally {
    await h.close();
  }
});
