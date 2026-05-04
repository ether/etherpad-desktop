import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch.js';

test('first launch shows the AddWorkspaceDialog as a non-dismissable modal', async () => {
  const h = await launchApp();
  try {
    await expect(h.shell.getByRole('heading', { name: /add a workspace/i })).toBeVisible();
    // Cancel button is hidden on first run (dismissable=false)
    await expect(h.shell.getByRole('button', { name: /cancel/i })).toHaveCount(0);
  } finally {
    await h.close();
  }
});
