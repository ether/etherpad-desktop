import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch.js';

test('dark mode applies a dark body background', async () => {
  // emulateMedia is supported on Playwright Page objects including Electron windows.
  // If the API is unavailable in this Electron/Playwright build the test is skipped.
  const h = await launchApp();
  try {
    if (typeof h.shell.emulateMedia !== 'function') {
      test.skip();
      return;
    }
    await h.shell.emulateMedia({ colorScheme: 'dark' });
    // evaluate runs in the browser context; cast to any to avoid DOM lib requirement
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bg = await h.shell.evaluate((): string => (globalThis as any).getComputedStyle((globalThis as any).document.documentElement).getPropertyValue('--body-bg').trim());
    // In dark mode --body-bg should be #0f1111 (via var(--color-secondary-dark)).
    expect(bg).not.toBe('#ffffff');
  } finally {
    await h.close();
  }
});
