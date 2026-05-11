/**
 * Dialog dismissal regression — covers the user-reported bug:
 *   "Clicking search all pads then trying to click off the modal or pressing
 *   escape doesn't work. It remains focused and overlayed — the same applies
 *   for the new pad modal."
 *
 * NOTE: The full dismissal contract (Escape closes / overlay click closes /
 * dismissable=false ignores Escape) is exercised exhaustively at the unit
 * layer in tests/renderer/components/DialogShell.spec.tsx and per-dialog
 * specs (QuickSwitcherDialog, AddWorkspaceDialog, OpenPadDialog). These two
 * E2E checks are the smoke-level confirmation that the logic survives a
 * real Electron renderer:
 *
 *   1. Escape dismisses a dismissable dialog (Open Pad).
 *   2. Escape does NOT dismiss the first-run AddWorkspaceDialog
 *      (dismissable=false), so we never end up in an unusable shell.
 */
import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch';

test('Open Pad dialog: Escape closes', async () => {
  const h = await launchApp();
  try {
    // Workspace is set up by the launch fixture's seedWorkspace helper if available;
    // otherwise we add one inline.
    await h.shell.getByLabel(/name/i).fill('DismissTest');
    await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
    await h.shell.getByRole('button', { name: /^add$/i }).click();
    await h.shell.getByRole('button', { name: /new pad/i }).click();
    await expect(h.shell.getByRole('heading', { name: /open a pad/i })).toBeVisible();
    await h.shell.keyboard.press('Escape');
    await expect(h.shell.getByRole('heading', { name: /open a pad/i })).toHaveCount(0);
  } finally {
    await h.close();
  }
});

test('AddWorkspaceDialog (first-run, dismissable=false): Escape does NOT close', async () => {
  const h = await launchApp();
  try {
    // First launch with no workspaces → dismissable=false modal.
    await expect(h.shell.getByRole('heading', { name: /add an etherpad instance/i })).toBeVisible();
    // Cancel button should not even be shown.
    await expect(h.shell.getByRole('button', { name: /cancel/i })).toHaveCount(0);
    // Press Escape — must NOT close (we'd have no workspace and an unusable shell).
    await h.shell.keyboard.press('Escape');
    await expect(h.shell.getByRole('heading', { name: /add an etherpad instance/i })).toBeVisible();
  } finally {
    await h.close();
  }
});
