import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch.js';

test('pinning a pad moves it to the Pinned section', async () => {
  const h = await launchApp();
  try {
    await h.shell.getByLabel(/name/i).fill('PinTest');
    await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
    await h.shell.getByRole('button', { name: /^add$/i }).click();
    await expect(h.shell.getByRole('button', { name: /open instance pintest/i })).toBeVisible();

    // Open a pad to populate history
    await h.shell.getByRole('button', { name: /new pad/i }).click();
    await h.shell.getByLabel(/pad name/i).fill('important');
    await h.shell.getByRole('button', { name: /^open$/i }).click();
    await expect(h.shell.getByRole('tab', { name: /important/ })).toBeVisible();

    // Pin via the ☆ button in the sidebar (recent section)
    await h.shell.getByRole('button', { name: /^pin important/i }).click();

    // Verify it's now under the Pinned heading (and shows ★)
    await expect(h.shell.getByRole('button', { name: /unpin important/i })).toBeVisible();
    await expect(
      h.shell.getByRole('button', { name: /unpin important/i }),
    ).toHaveAttribute('aria-pressed', 'true');
  } finally {
    await h.close();
  }
});
