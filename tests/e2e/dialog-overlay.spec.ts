import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch.js';

test('opening a dialog while a pad is loaded shows the dialog (no grey screen)', async () => {
  const h = await launchApp();
  try {
    // Add workspace
    await h.shell.getByLabel(/name/i).fill('Test');
    await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
    await h.shell.getByRole('button', { name: /^add$/i }).click();
    await expect(h.shell.getByRole('button', { name: /open workspace test/i })).toBeVisible();

    // Open a pad
    await h.shell.getByRole('button', { name: /new pad/i }).click();
    await h.shell.getByLabel(/pad name/i).fill('p1');
    await h.shell.getByRole('button', { name: /^open$/i }).click();
    await expect(h.shell.getByRole('tab', { name: /p1/ })).toBeVisible();

    // The pad now occupies the main area. Click + New Pad again.
    await h.shell.getByRole('button', { name: /new pad/i }).click();

    // The dialog must be visible AND interactive.
    const dialog = h.shell.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /open a pad/i })).toBeVisible();
    await expect(dialog.getByLabel(/pad name/i)).toBeVisible();
  } finally {
    await h.close();
  }
});
