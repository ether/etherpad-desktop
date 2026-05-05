import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch.js';

test('tab error overlay shows Retry and Close tab buttons when a tab enters error state', async () => {
  const h = await launchApp();
  try {
    // Add workspace and open a pad so there is at least one tab in the store
    await h.shell.getByLabel(/name/i).fill('Fixture');
    await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
    await h.shell.getByRole('button', { name: /^add$/i }).click();
    await expect(h.shell.getByRole('button', { name: /open workspace fixture/i })).toBeVisible();

    await h.shell.getByRole('button', { name: /new pad/i }).click();
    await h.shell.getByLabel(/pad name/i).fill('error-overlay-test');
    await h.shell.getByRole('button', { name: /^open$/i }).click();
    await expect(h.shell.getByRole('tab', { name: /error-overlay-test/ })).toBeVisible();

    // Use the test seam to force the active tab into error state.
    // evaluate() runs inside the renderer (browser context); cast via globalThis to avoid
    // TypeScript DOM lib requirement in the Node-typed tests tsconfig.
    await h.shell.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = globalThis as any;
      const store = g.__test_useShellStore;
      if (!store) throw new Error('__test_useShellStore not attached — E2E_TEST flag missing?');
      const state = store.getState();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tabs: any[] = state.tabs;
      const activeId: string | null = state.activeTabId ?? tabs[0]?.tabId ?? null;
      if (!activeId) throw new Error('no active tab to put into error state');
      store.setState({
        tabs: tabs.map((t: { tabId: string; state: string }) =>
          t.tabId === activeId ? { ...t, state: 'error', errorMessage: 'Test-induced error' } : t,
        ),
        activeTabId: activeId,
      });
    });

    // The TabErrorOverlay should now be visible
    const overlay = h.shell.getByRole('alert');
    await expect(overlay).toBeVisible();
    // Retry button appears for error state (not crashed)
    await expect(overlay.getByRole('button', { name: /retry/i })).toBeVisible();
    // Close pad button appears (scoped to the overlay to avoid the tab-strip close button)
    await expect(overlay.getByRole('button', { name: /close pad/i })).toBeVisible();
  } finally {
    await h.close();
  }
});
