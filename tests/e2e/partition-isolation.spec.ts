/**
 * partition-isolation.spec.ts
 *
 * Verifies that two workspaces maintain independent tab sets and pad history.
 * Both workspaces point at the same fixture Etherpad, so we cannot test
 * cookie isolation directly, but we can verify that:
 *  1. Opening the same pad name in two workspaces produces two independent
 *     tabs (one per workspace).
 *  2. Removing one workspace clears its pad history but leaves the other's
 *     history intact.
 */
import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch.js';

type AppHandle = Awaited<ReturnType<typeof launchApp>>;

async function addWorkspace(h: AppHandle, name: string, isFirst = false) {
  if (!isFirst) {
    await h.shell.getByRole('button', { name: /add workspace/i }).click();
  }
  await h.shell.getByLabel(/name/i).fill(name);
  await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
  await h.shell.getByRole('button', { name: /^add$/i }).click();
  await expect(h.shell.getByRole('button', { name: new RegExp(`open workspace ${name}`, 'i') })).toBeVisible();
}

async function openPad(h: AppHandle, padName: string) {
  await h.shell.getByRole('button', { name: /new pad/i }).click();
  await h.shell.getByLabel(/pad name/i).fill(padName);
  await h.shell.getByRole('button', { name: /^open$/i }).click();
  await expect(h.shell.getByRole('tab', { name: new RegExp(padName) })).toBeVisible();
}

test('same pad name in two workspaces produces two independent tabs', async () => {
  const h = await launchApp();
  try {
    // Add workspace A (first — fills the initial AddWorkspaceDialog)
    await addWorkspace(h, 'Iso-A', true);

    // Open 'samepad' in workspace A
    await openPad(h, 'samepad');

    // Switch to / add workspace B
    await addWorkspace(h, 'Iso-B');

    // Open 'samepad' in workspace B (same pad name, different workspace)
    await openPad(h, 'samepad');

    // Switch back to workspace A — it should have its own 'samepad' tab
    await h.shell.getByRole('button', { name: /open workspace iso-a/i }).click();
    await expect(h.shell.getByRole('tab', { name: /samepad/ })).toBeVisible();

    // Switch to workspace B — it also has its own 'samepad' tab
    await h.shell.getByRole('button', { name: /open workspace iso-b/i }).click();
    await expect(h.shell.getByRole('tab', { name: /samepad/ })).toBeVisible();

    // Total tab count across the two workspaces should be 2
    // (the tabstrip only shows tabs for the active workspace, so we verify
    //  each workspace independently rather than counting all tabs at once)
  } finally {
    await h.close();
  }
});

test('removing workspace A clears its history but not workspace B history', async () => {
  const h = await launchApp();
  try {
    await addWorkspace(h, 'Rm-A', true);
    await openPad(h, 'pad-a');

    await addWorkspace(h, 'Rm-B');
    await openPad(h, 'pad-b');

    // Confirm pad-b appears in workspace B's sidebar
    // Use class-scoped selector to avoid matching the pin button (aria-label="Pin pad-b")
    await expect(h.shell.locator('.pad-open', { hasText: 'pad-b' })).toBeVisible();

    // Switch to workspace A and verify pad-a is in its history
    await h.shell.getByRole('button', { name: /open workspace rm-a/i }).click();
    await expect(h.shell.locator('.pad-open', { hasText: 'pad-a' })).toBeVisible();

    // Remove workspace A via Settings
    await h.shell.getByRole('button', { name: /^settings$/i }).click();
    await expect(h.shell.getByRole('heading', { name: /^settings$/i })).toBeVisible();
    // There are two workspaces listed; click the Remove for Rm-A (first listed)
    const removeButtons = h.shell.getByRole('button', { name: /^remove$/i });
    await removeButtons.first().click();
    // Confirm removal
    await h.shell.getByRole('button', { name: /^remove$/i }).click();

    // Workspace A rail button should be gone
    await expect(h.shell.getByRole('button', { name: /open workspace rm-a/i })).toHaveCount(0);

    // Switch to workspace B — its history (pad-b) must still be intact
    await h.shell.getByRole('button', { name: /open workspace rm-b/i }).click();
    await expect(h.shell.locator('.pad-open', { hasText: 'pad-b' })).toBeVisible();
  } finally {
    await h.close();
  }
});
