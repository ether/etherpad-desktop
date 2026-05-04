import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch.js';

test('adding a workspace pointing at the fixture Etherpad succeeds and shows in the rail', async () => {
  const h = await launchApp();
  try {
    await h.shell.getByLabel(/name/i).fill('Fixture');
    await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
    await h.shell.getByRole('button', { name: /^add$/i }).click();

    // Dialog dismisses; rail now contains a button for "Fixture".
    await expect(h.shell.getByRole('button', { name: /open workspace fixture/i })).toBeVisible();
    await expect(h.shell.getByRole('heading', { name: /add a workspace/i })).toBeHidden();
  } finally {
    await h.close();
  }
});

test('adding an unreachable URL shows the unreachable error', async () => {
  const h = await launchApp();
  try {
    await h.shell.getByLabel(/name/i).fill('X');
    await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9');
    await h.shell.getByRole('button', { name: /^add$/i }).click();
    await expect(h.shell.getByText(/could not reach that server/i)).toBeVisible();
  } finally {
    await h.close();
  }
});
