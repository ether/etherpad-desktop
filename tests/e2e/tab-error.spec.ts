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

    // Use the test seam to force the active tab into error state
    await h.shell.evaluate(() => {
      const store = (window as Window & { __test_useShellStore?: { getState: () => { tabs: Array<{ tabId: string; workspaceId: string; padName: string; state: string; title?: string }>; activeTabId: string | null }; setState: (s: unknown) => void } }).__test_useShellStore;
      if (!store) throw new Error('__test_useShellStore not attached — E2E_TEST flag missing?');
      const state = store.getState();
      const tabs = state.tabs;
      const activeId = state.activeTabId ?? tabs[0]?.tabId;
      if (!activeId) throw new Error('no active tab to put into error state');
      store.setState({
        tabs: tabs.map((t: { tabId: string; workspaceId: string; padName: string; state: string }) =>
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
    // Close tab button appears (scoped to the overlay to avoid the tab-strip close button)
    await expect(overlay.getByRole('button', { name: /close tab/i })).toBeVisible();
  } finally {
    await h.close();
  }
});
