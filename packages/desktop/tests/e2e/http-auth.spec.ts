import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch.js';

test('HTTP auth dialog opens and shows "Authentication required" heading', async () => {
  const h = await launchApp();
  try {
    // Add a workspace so App hydrates and the test seam is wired up by App.tsx module scope
    await h.shell.getByLabel(/name/i).fill('Fixture');
    await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
    await h.shell.getByRole('button', { name: /^add$/i }).click();
    await expect(h.shell.getByRole('button', { name: /open instance fixture/i })).toBeVisible();

    // Trigger the http-auth dialog via the test seam
    await h.shell.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = globalThis as any;
      const actions = g.__test_dialogActions;
      if (!actions) throw new Error('__test_dialogActions not attached — E2E_TEST flag missing?');
      actions.openHttpAuth('r1', 'https://x');
    });

    // The HttpAuthDialog should now be visible with its heading
    await expect(h.shell.getByRole('dialog')).toBeVisible();
    await expect(h.shell.getByRole('heading', { name: /authentication required/i })).toBeVisible();
  } finally {
    await h.close();
  }
});
