import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch.js';

test('removing a workspace closes its tabs and clears its history', async () => {
  const h = await launchApp();
  try {
    await h.shell.getByLabel(/name/i).fill('Doomed');
    await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
    await h.shell.getByRole('button', { name: /^add$/i }).click();
    await expect(h.shell.getByRole('button', { name: /open workspace doomed/i })).toBeVisible();

    // Open a pad
    await h.shell.getByRole('button', { name: /new pad/i }).click();
    await h.shell.getByLabel(/pad name/i).fill('to-be-deleted');
    await h.shell.getByRole('button', { name: /^open$/i }).click();
    await expect(h.shell.getByRole('tab', { name: /to-be-deleted/ })).toBeVisible();

    // Open settings → remove workspace
    await h.shell.getByRole('button', { name: /^settings$/i }).click();
    // SettingsDialog lists workspaces with a "Remove" button per workspace
    await h.shell.getByRole('button', { name: /^remove$/i }).click();
    // RemoveWorkspaceDialog opens; click the confirm "Remove" button
    await h.shell.getByRole('button', { name: /^remove$/i }).click();

    // Tab and workspace button should be gone after removal
    await expect(h.shell.getByRole('tab', { name: /to-be-deleted/ })).toHaveCount(0);
    await expect(h.shell.getByRole('button', { name: /open workspace doomed/i })).toHaveCount(0);
  } finally {
    await h.close();
  }
});
