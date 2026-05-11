/**
 * "Open Pad by URL" — paste an Etherpad pad URL, the app adds the
 * instance (if needed) and opens the pad in one step.
 *
 * Tests the two key branches:
 *   1. Pasting a URL whose server isn't yet configured: the instance
 *      gets added with the host as the default name, the rail icon
 *      appears, and the pad opens as a tab.
 *   2. Pasting a URL whose server IS already configured: no second
 *      instance is added, the pad opens in the existing instance.
 */
import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch';
import type { Page } from '@playwright/test';

async function setupOneInstance(shell: Page, name: string) {
  await shell.getByLabel(/name/i).fill(name);
  await shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
  await shell.getByRole('button', { name: /^add$/i }).click();
  await expect(shell.getByRole('button', { name: new RegExp(`open instance ${name}`, 'i') })).toBeVisible();
}

test('Open by URL: adds a new instance and opens the pad', async () => {
  const h = await launchApp();
  try {
    await setupOneInstance(h.shell, 'Existing');

    // Use a different host so the URL points at a NEW instance.
    // The fixture also serves http://localhost:9003, so the desktop
    // probe will succeed (the in-process mock returns Etherpad-shaped
    // /api/) — we use 'localhost' instead of '127.0.0.1' to be a
    // distinct serverUrl from the existing 'Existing' instance.
    await h.shell.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = globalThis as any;
      g.__test_dialogActions?.openOpenByUrl?.();
    });
    // Fallback: open via menu broadcast if the seam isn't wired.
    await h.app.evaluate(({ webContents }) => {
      for (const wc of webContents.getAllWebContents()) {
        const url = wc.getURL();
        if ((url.startsWith('file://') || url.includes('localhost')) && !url.includes('/p/')) {
          wc.send('menu.openByUrl', { kind: 'menu.openByUrl' });
        }
      }
    });
    await expect(h.shell.getByRole('heading', { name: /open pad by url/i })).toBeVisible();

    await h.shell.getByLabel(/paste an etherpad pad url/i).fill('http://localhost:9003/p/from-url-pad');
    await h.shell.getByRole('button', { name: /^open$/i }).click();

    // New instance appears in the rail; default name = host.
    await expect(h.shell.getByRole('button', { name: /open instance localhost/i })).toBeVisible();
    // Pad tab opens.
    await expect(h.shell.getByRole('tab', { name: /from-url-pad/ })).toBeVisible();
  } finally {
    await h.close();
  }
});

test('Open by URL: reuses an existing instance when the serverUrl matches', async () => {
  const h = await launchApp();
  try {
    await setupOneInstance(h.shell, 'Reused');

    // Open via menu broadcast.
    await h.app.evaluate(({ webContents }) => {
      for (const wc of webContents.getAllWebContents()) {
        const url = wc.getURL();
        if ((url.startsWith('file://') || url.includes('localhost')) && !url.includes('/p/')) {
          wc.send('menu.openByUrl', { kind: 'menu.openByUrl' });
        }
      }
    });
    await expect(h.shell.getByRole('heading', { name: /open pad by url/i })).toBeVisible();

    await h.shell.getByLabel(/paste an etherpad pad url/i).fill('http://127.0.0.1:9003/p/reused-pad');
    await h.shell.getByRole('button', { name: /^open$/i }).click();

    // Pad tab opens in the existing instance.
    await expect(h.shell.getByRole('tab', { name: /reused-pad/ })).toBeVisible();
    // No second instance was added — only "Reused" is in the rail.
    const rail = h.shell.getByRole('navigation', { name: /etherpad instance rail/i });
    const icons = rail.getByRole('button', { name: /^open instance/i });
    await expect(icons).toHaveCount(1);
  } finally {
    await h.close();
  }
});

test('Open by URL: malformed URL shows inline error', async () => {
  const h = await launchApp();
  try {
    await setupOneInstance(h.shell, 'ErrTest');
    await h.app.evaluate(({ webContents }) => {
      for (const wc of webContents.getAllWebContents()) {
        const url = wc.getURL();
        if ((url.startsWith('file://') || url.includes('localhost')) && !url.includes('/p/')) {
          wc.send('menu.openByUrl', { kind: 'menu.openByUrl' });
        }
      }
    });
    await expect(h.shell.getByRole('heading', { name: /open pad by url/i })).toBeVisible();

    await h.shell.getByLabel(/paste an etherpad pad url/i).fill('not a url');
    await h.shell.getByRole('button', { name: /^open$/i }).click();

    await expect(h.shell.getByRole('alert')).toContainText(/doesn.?t look like a pad url/i);
  } finally {
    await h.close();
  }
});
