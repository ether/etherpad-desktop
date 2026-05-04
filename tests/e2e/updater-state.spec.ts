import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch';

test('updater banner appears when state.kind === "ready"', async () => {
  const h = await launchApp();
  try {
    await h.shell.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = globalThis as any;
      const store = g.__test_useShellStore;
      if (!store) throw new Error('test seam missing');
      store.setState({ updaterState: { kind: 'ready', version: '9.9.9' } });
    });
    await expect(h.shell.getByRole('status')).toContainText(/9\.9\.9/);
    await expect(h.shell.getByRole('button', { name: /restart/i })).toBeVisible();
  } finally {
    await h.close();
  }
});

test('updater banner disappears when state.kind === "idle"', async () => {
  const h = await launchApp();
  try {
    await h.shell.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = globalThis as any;
      const store = g.__test_useShellStore;
      if (!store) throw new Error('test seam missing');
      // First set ready, then idle — banner should vanish
      store.setState({ updaterState: { kind: 'ready', version: '9.9.9' } });
      store.setState({ updaterState: { kind: 'idle' } });
    });
    await expect(h.shell.getByRole('button', { name: /restart/i })).not.toBeVisible();
  } finally {
    await h.close();
  }
});
