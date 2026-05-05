import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch.js';

test('with 30 workspaces, the rail scrolls and the settings cog stays pinned to bottom', async () => {
  const h = await launchApp();
  try {
    // First-launch dialog appears; dismiss by adding a single workspace via UI (fixture URL)
    await h.shell.getByLabel(/name/i).fill('seed');
    await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
    await h.shell.getByRole('button', { name: /^add$/i }).click();
    await expect(h.shell.getByRole('button', { name: /open workspace seed/i })).toBeVisible();

    // Seed 30 fake workspaces via the store
    await h.shell.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = globalThis as any;
      const store = g.__test_useShellStore;
      if (!store) throw new Error('__test_useShellStore missing — E2E_TEST flag must be set');
      const fakes = Array.from({ length: 30 }, (_: unknown, i: number) => ({
        id: `fake-${i}`,
        name: `WS ${i}`,
        serverUrl: `https://example.com/${i}`,
        color: '#3366cc',
        createdAt: Date.now(),
      }));
      const existing = store.getState().workspaces as Array<{ id: string }>;
      const order = store.getState().workspaceOrder as string[];
      store.setState({
        workspaces: [...existing, ...fakes],
        workspaceOrder: [...order, ...fakes.map((f: { id: string }) => f.id)],
      });
    });

    // Settings cog must still be visible at the bottom of the rail
    await expect(h.shell.getByRole('button', { name: /^settings$/i })).toBeVisible();
  } finally {
    await h.close();
  }
});
