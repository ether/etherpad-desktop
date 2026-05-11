import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch.js';

test('with 50+ pads in history, sidebar scrolls and last pad is reachable', async () => {
  const h = await launchApp();
  try {
    // Add a workspace
    await h.shell.getByLabel(/name/i).fill('Many');
    await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
    await h.shell.getByRole('button', { name: /^add$/i }).click();
    await expect(h.shell.getByRole('button', { name: /open instance many/i })).toBeVisible();

    // Seed 50 pads in history via the test seam (faster than opening 50 pads through the UI)
    await h.shell.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = globalThis as any;
      const store = g.__test_useShellStore;
      if (!store) throw new Error('__test_useShellStore missing — E2E_TEST flag must be set');
      const { workspaces, activeWorkspaceId } = store.getState() as {
        workspaces: Array<{ id: string }>;
        activeWorkspaceId: string | null;
      };
      const wsId = activeWorkspaceId || workspaces[0]?.id;
      if (!wsId) throw new Error('no workspace');
      const padHistory: Record<string, Array<{ workspaceId: string; padName: string; lastOpenedAt: number; pinned: boolean }>> = {
        [wsId]: [],
      };
      for (let i = 0; i < 50; i++) {
        padHistory[wsId]!.push({
          workspaceId: wsId,
          padName: `pad-${String(i).padStart(3, '0')}`,
          lastOpenedAt: Date.now() - (50 - i) * 1000,
          pinned: false,
        });
      }
      store.setState({ padHistory });
    });

    // Most recently opened pad should be visible (pad-049 was last touched)
    await expect(h.shell.getByText('pad-049')).toBeVisible();

    // Last pad must be reachable by scrolling — scroll into view and assert visible
    const lastRow = h.shell.getByText('pad-000');
    await lastRow.scrollIntoViewIfNeeded();
    await expect(lastRow).toBeVisible();
  } finally {
    await h.close();
  }
});
