/**
 * keyboard-shortcuts.spec.ts
 *
 * Tests for menu accelerators (Ctrl+T, Ctrl+W, Ctrl+,, Ctrl+R).
 *
 * Native menu accelerators are NOT reliably deliverable by Playwright in an
 * xvfb/headless environment — Electron processes them from the OS-level key
 * event only when the native menu is registered, but xvfb does not forward
 * accelerators through the native menu to the renderer via keyboard simulation.
 *
 * Strategy: instead of simulating keystrokes, we drive the same code path
 * that the accelerators invoke. In the live app the accelerator fires
 *   Menu item click → cb.newTab() / cb.settings() etc.
 *   → ipcRef.current?.broadcastShell('menu.newTab')
 *   → renderer onMenuShellMessage → dialogActions.openDialog(...)
 *
 * We use app.evaluate() (runs in the Electron main process) to fire the
 * same ipcMain-level broadcast that the accelerator would, and then assert
 * the expected UI change in the renderer.
 *
 * For Ctrl+W the implementation uses role:'close' on the menu item which
 * maps to BrowserWindow.close() — that would close the window in a real
 * app. In tests we verify the tab IPC path (ipc.tab.close) directly from
 * the renderer instead.
 */
import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch.js';

type AppHandle = Awaited<ReturnType<typeof launchApp>>;

async function setupOneWorkspace(h: AppHandle, name: string) {
  await h.shell.getByLabel(/name/i).fill(name);
  await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
  await h.shell.getByRole('button', { name: /^add$/i }).click();
  await expect(h.shell.getByRole('button', { name: new RegExp(`open workspace ${name}`, 'i') })).toBeVisible();
}

async function openPad(h: AppHandle, name: string) {
  await h.shell.getByRole('button', { name: /new pad/i }).click();
  await h.shell.getByLabel(/pad name/i).fill(name);
  await h.shell.getByRole('button', { name: /^open$/i }).click();
  await expect(h.shell.getByRole('tab', { name: new RegExp(name) })).toBeVisible();
}

/** Send a menu shell message via the main-process broadcast path.
 *
 * The app uses BaseWindow + WebContentsView (not BrowserWindow), so
 * BrowserWindow.getAllWindows() returns nothing.  We reach all WebContents
 * via webContents.getAllWebContents() and broadcast to whichever one loaded
 * the renderer HTML (i.e. the shell view).
 */
async function triggerMenuAction(h: AppHandle, channel: string) {
  await h.app.evaluate(({ webContents }, { ch }) => {
    for (const wc of webContents.getAllWebContents()) {
      // Only send to the shell renderer (not pad WebContentsViews which load
      // Etherpad).  The shell loads a file:// or localhost renderer URL.
      const url = wc.getURL();
      if (url.startsWith('file://') || url.includes('localhost') || url.includes('127.0.0.1:') && !url.includes('/p/')) {
        // Exclude pad views (they load /p/<name>) — send to shell only
        if (!url.includes('/p/')) {
          wc.send(ch, { kind: ch });
        }
      }
    }
  }, { ch: channel });
}

test('Ctrl+T equivalent — menu.newTab opens OpenPadDialog', async () => {
  const h = await launchApp();
  try {
    await setupOneWorkspace(h, 'KbdT');

    // Simulate the accelerator via the same IPC path the native shortcut uses
    await triggerMenuAction(h, 'menu.newTab');

    // OpenPadDialog should now be visible
    await expect(h.shell.getByRole('dialog')).toBeVisible();
    await expect(h.shell.getByRole('heading', { name: /open a pad/i })).toBeVisible();
  } finally {
    await h.close();
  }
});

test('Ctrl+, equivalent — menu.settings opens Settings dialog', async () => {
  const h = await launchApp();
  try {
    await setupOneWorkspace(h, 'KbdComma');

    await triggerMenuAction(h, 'menu.settings');

    await expect(h.shell.getByRole('dialog')).toBeVisible();
    await expect(h.shell.getByRole('heading', { name: /^settings$/i })).toBeVisible();
  } finally {
    await h.close();
  }
});

// FEATURE: 2026-05-05 — Ctrl/Cmd+1..9 fast-switch to the Nth pad of the
// active workspace, matching browser tab-switch shortcuts. The shortcut
// is a renderer-side keydown listener (not a native menu accelerator),
// so we simulate the keypress via Playwright's keyboard API.
test('Ctrl+1 focuses the first pad of the active workspace', async () => {
  const h = await launchApp();
  try {
    await setupOneWorkspace(h, 'KbdNum');
    await openPad(h, 'pad-1');
    await openPad(h, 'pad-2');
    await openPad(h, 'pad-3');
    // pad-3 is the latest opened, likely active. Press Ctrl+1.
    await h.shell.keyboard.press('Control+1');
    // Active tab is pad-1 — its tab should carry aria-selected=true.
    const tab1 = h.shell.getByRole('tab', { name: /pad-1/ });
    await expect(tab1).toHaveAttribute('aria-selected', 'true');
  } finally {
    await h.close();
  }
});

test('Ctrl+9 jumps to the LAST pad (browser convention)', async () => {
  const h = await launchApp();
  try {
    await setupOneWorkspace(h, 'KbdNum9');
    await openPad(h, 'pad-a');
    await openPad(h, 'pad-b');
    await openPad(h, 'pad-c');
    // Switch back to pad-a first so we have something to switch FROM.
    await h.shell.getByRole('tab', { name: /pad-a/ }).click();
    await expect(h.shell.getByRole('tab', { name: /pad-a/ })).toHaveAttribute('aria-selected', 'true');
    // Now Ctrl+9 → last pad (pad-c).
    await h.shell.keyboard.press('Control+9');
    await expect(h.shell.getByRole('tab', { name: /pad-c/ })).toHaveAttribute('aria-selected', 'true');
  } finally {
    await h.close();
  }
});

test('Ctrl+1 is a no-op when typing in an input field', async () => {
  const h = await launchApp();
  try {
    await setupOneWorkspace(h, 'KbdNumInput');
    await openPad(h, 'pad-1');
    await openPad(h, 'pad-2');
    // Open a dialog with an input (Open Pad)
    await h.shell.getByRole('button', { name: /new pad/i }).click();
    const padNameInput = h.shell.getByLabel(/pad name/i);
    await padNameInput.fill('test1');
    // Inside the input, Ctrl+1 must NOT switch tabs — the dialog stays.
    await padNameInput.press('Control+1');
    await expect(h.shell.getByRole('heading', { name: /open a pad/i })).toBeVisible();
  } finally {
    await h.close();
  }
});

test('Ctrl+W equivalent — close tab via IPC removes the tab', async () => {
  // Ctrl+W uses role:'close' on the menu item which maps to BrowserWindow close.
  // In tests we verify the tab.close IPC path directly from the renderer,
  // which is the same logic the close-tab button in the strip calls.
  const h = await launchApp();
  try {
    await setupOneWorkspace(h, 'KbdW');
    await openPad(h, 'pad-w-1');
    await openPad(h, 'pad-w-2');

    // Two tabs open; close the first via the close-tab button (same code path
    // as Ctrl+W closing the active tab)
    await h.shell.getByRole('button', { name: /close pad/i }).first().click();

    // Only one tab should remain
    const tabs = h.shell.getByRole('tab');
    await expect(tabs).toHaveCount(1);
  } finally {
    await h.close();
  }
});

test('Ctrl+R equivalent — menu.reload reloads the active pad', async () => {
  // menu.reload triggers broadcastShell('menu.reload') → renderer's
  // onMenuShellMessage handler calls ipc.tab.reload({ tabId: activeTabId }).
  // We verify the tab survives the reload (no crash, tab still present).
  const h = await launchApp();
  try {
    await setupOneWorkspace(h, 'KbdR');
    await openPad(h, 'pad-r');

    // Trigger menu.reload via the same broadcast path
    await triggerMenuAction(h, 'menu.reload');

    // App must still be alive, tab must remain, no error state
    await expect(h.shell.getByRole('tab', { name: /pad-r/ })).toBeVisible();
  } finally {
    await h.close();
  }
});
