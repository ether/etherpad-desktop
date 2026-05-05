import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch.js';

test('workspace rail collapse/expand toggle for focused writing mode', async () => {
  const h = await launchApp();
  try {
    // Add a workspace so the rail shows an icon
    await h.shell.getByLabel(/name/i).fill('Test');
    await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
    await h.shell.getByRole('button', { name: /^add$/i }).click();
    await expect(h.shell.getByRole('button', { name: /open instance test/i })).toBeVisible();

    // Collapse the rail
    await h.shell.getByTitle(/hide instances/i).click();

    // Workspace icon should no longer be visible
    await expect(h.shell.getByRole('button', { name: /open instance test/i })).not.toBeVisible();

    // Expand again
    await h.shell.getByTitle(/show instances/i).click();

    // Workspace icon back
    await expect(h.shell.getByRole('button', { name: /open instance test/i })).toBeVisible();
  } finally {
    await h.close();
  }
});
