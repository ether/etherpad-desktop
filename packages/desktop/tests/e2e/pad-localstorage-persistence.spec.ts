/**
 * REGRESSION: 2026-05-05 — user reported that ep_webrtc's "Enable Audio /
 * Video Chat" toggle didn't persist across a reload, even though the
 * setting persisted in a regular browser pointed at the same Etherpad.
 *
 * That points the finger at our partition wiring (`persist:ws-${id}`):
 * if localStorage doesn't survive a navigation/reload inside a pad
 * WebContentsView, plugins like ep_webrtc that persist UI state in
 * localStorage will appear to "forget" their settings.
 *
 * These tests pin the contract: localStorage written inside a pad view
 * MUST survive both (1) a same-origin reload and (2) closing+reopening
 * the same tab in the same workspace.
 *
 * If either of these fails, the bug is in our partition setup — not in
 * ep_webrtc. If both pass, the user's missing-persistence is somewhere
 * outside our control (server-side toggle, cookie SameSite, etc.).
 */
import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch';
import type { Page } from '@playwright/test';

async function setupAndOpenPad(h: Awaited<ReturnType<typeof launchApp>>, padName: string) {
  await h.shell.getByLabel(/name/i).fill('LocalStore');
  await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
  await h.shell.getByRole('button', { name: /^add$/i }).click();
  await h.shell.getByRole('button', { name: /new pad/i }).click();
  await h.shell.getByLabel(/pad name/i).fill(padName);
  await h.shell.getByRole('button', { name: /^open$/i }).click();
  await expect(h.shell.getByRole('tab', { name: new RegExp(padName) })).toBeVisible();
}

/**
 * Find the WebContentsView page that loaded the pad URL. The shell window
 * is the React renderer; the pad lives in a separate Electron target with
 * a URL containing `/p/<padName>`.
 */
async function padPage(h: Awaited<ReturnType<typeof launchApp>>, padName: string): Promise<Page> {
  // Wait for the pad target to exist — firstWindow() returns the shell;
  // the pad attaches asynchronously after webContents.loadURL resolves.
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    for (const w of h.app.windows()) {
      const url = w.url();
      if (url.includes(`/p/${encodeURIComponent(padName)}`) || url.includes(`/p/${padName}`)) {
        return w;
      }
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`pad page for "${padName}" never loaded`);
}

test('localStorage written inside a pad survives a same-origin reload', async () => {
  const h = await launchApp();
  try {
    await setupAndOpenPad(h, 'ls-reload');
    const pad = await padPage(h, 'ls-reload');

    // Write a sentinel into localStorage on the pad's origin.
    await pad.evaluate(() => localStorage.setItem('epd_persist_test', 'before-reload'));

    // Reload the pad (same origin, same partition).
    await pad.reload();

    const after = await pad.evaluate(() => localStorage.getItem('epd_persist_test'));
    expect(after).toBe('before-reload');
  } finally {
    await h.close();
  }
});

test('localStorage in a pad survives closing + reopening the same tab', async () => {
  const h = await launchApp();
  try {
    await setupAndOpenPad(h, 'ls-reopen');
    const pad = await padPage(h, 'ls-reopen');

    await pad.evaluate(() => localStorage.setItem('epd_persist_test', 'before-close'));

    // Close the tab via the close-pad button.
    await h.shell.getByRole('button', { name: /close pad/i }).first().click();
    await expect(h.shell.getByRole('tab', { name: /ls-reopen/ })).toHaveCount(0);

    // Reopen the same pad (same workspace → same partition).
    await h.shell.getByRole('button', { name: /new pad/i }).click();
    await h.shell.getByLabel(/pad name/i).fill('ls-reopen');
    await h.shell.getByRole('button', { name: /^open$/i }).click();
    await expect(h.shell.getByRole('tab', { name: /ls-reopen/ })).toBeVisible();

    const reopened = await padPage(h, 'ls-reopen');
    const after = await reopened.evaluate(() => localStorage.getItem('epd_persist_test'));
    expect(after).toBe('before-close');
  } finally {
    await h.close();
  }
});
