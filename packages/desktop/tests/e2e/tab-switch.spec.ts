import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch.js';

test('clicking between tabs switches the visible pad', async () => {
  const h = await launchApp();
  try {
    // Add workspace pointing at the fixture Etherpad
    await h.shell.getByLabel(/name/i).fill('Switcher');
    await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
    await h.shell.getByRole('button', { name: /^add$/i }).click();
    await expect(h.shell.getByRole('button', { name: /open instance switcher/i })).toBeVisible();

    // Open first pad
    await h.shell.getByRole('button', { name: /new pad/i }).click();
    await h.shell.getByLabel(/pad name/i).fill('alpha');
    await h.shell.getByRole('button', { name: /^open$/i }).click();
    await expect(h.shell.getByRole('tab', { name: /alpha/ })).toBeVisible();

    // Open second pad
    await h.shell.getByRole('button', { name: /new pad/i }).click();
    await h.shell.getByLabel(/pad name/i).fill('bravo');
    await h.shell.getByRole('button', { name: /^open$/i }).click();
    await expect(h.shell.getByRole('tab', { name: /bravo/ })).toBeVisible();

    // After opening bravo, the store's activeTabId should point to bravo
    const stateAfterOpen = await h.shell.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = globalThis as any;
      const store = g.__test_useShellStore;
      if (!store) throw new Error('__test_useShellStore not attached — E2E_TEST flag missing?');
      const s = store.getState();
      return {
        activeTabId: s.activeTabId,
        tabs: s.tabs.map((t: { tabId: string; padName: string }) => ({
          tabId: t.tabId,
          padName: t.padName,
        })),
      };
    });
    const bravoTab = stateAfterOpen.tabs.find((t: { padName: string }) => t.padName === 'bravo');
    expect(bravoTab).toBeDefined();
    expect(stateAfterOpen.activeTabId).toBe(bravoTab!.tabId);

    // Click the alpha tab
    await h.shell.getByRole('tab', { name: /alpha/ }).click();

    // After clicking alpha, the store's activeTabId should now point to alpha
    const stateAfterSwitch = await h.shell.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = globalThis as any;
      const store = g.__test_useShellStore;
      const s = store.getState();
      return {
        activeTabId: s.activeTabId,
        tabs: s.tabs.map((t: { tabId: string; padName: string }) => ({
          tabId: t.tabId,
          padName: t.padName,
        })),
      };
    });
    const alphaTab = stateAfterSwitch.tabs.find((t: { padName: string }) => t.padName === 'alpha');
    expect(alphaTab).toBeDefined();
    expect(stateAfterSwitch.activeTabId).toBe(alphaTab!.tabId);

    // Click back to bravo to verify we can switch multiple times
    await h.shell.getByRole('tab', { name: /bravo/ }).click();

    const stateAfterSwitchBack = await h.shell.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = globalThis as any;
      const store = g.__test_useShellStore;
      const s = store.getState();
      return {
        activeTabId: s.activeTabId,
        tabs: s.tabs.map((t: { tabId: string; padName: string }) => ({
          tabId: t.tabId,
          padName: t.padName,
        })),
      };
    });
    const bravoTabAfter = stateAfterSwitchBack.tabs.find(
      (t: { padName: string }) => t.padName === 'bravo',
    );
    expect(bravoTabAfter).toBeDefined();
    expect(stateAfterSwitchBack.activeTabId).toBe(bravoTabAfter!.tabId);
  } finally {
    await h.close();
  }
});
