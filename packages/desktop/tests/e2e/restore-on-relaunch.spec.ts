import { test, expect } from '@playwright/test';
import { rmSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp } from './fixtures/launch.js';

// Extra runway on top of playwright.config.ts's 120s default — this test
// does two full cold-starts back-to-back (h1 + h2). Under xvfb suite
// contention either can drift past 60s.
test.setTimeout(240_000);

test('relaunching restores workspaces, the active workspace, and open tabs', async () => {
  // First launch: add workspace + open a pad
  const h1 = await launchApp();
  await h1.shell.getByLabel(/name/i).fill('Sticky');
  await h1.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
  await h1.shell.getByRole('button', { name: /^add$/i }).click();
  await expect(h1.shell.getByRole('button', { name: /open instance sticky/i })).toBeVisible();

  await h1.shell.getByRole('button', { name: /new pad/i }).click();
  await h1.shell.getByLabel(/pad name/i).fill('survives-restart');
  await h1.shell.getByRole('button', { name: /^open$/i }).click();
  await expect(h1.shell.getByRole('tab', { name: /survives-restart/ })).toBeVisible();

  const userDataDir = h1.userDataDir;
  // Close the app without wiping userData (don't call h1.close() which runs cleanup)
  await h1.app.close();

  // Sanity-check that h1 actually persisted what we asked it to BEFORE
  // launching h2. Splits "persistence broke" from "renderer didn't
  // hydrate" cleanly when the test flakes — both have surfaced as the
  // same "button not visible" failure in past runs.
  const findStoreFile = (basename: string): string | null => {
    const candidates = [
      join(userDataDir, basename),
      join(userDataDir, 'etherpad-desktop', basename),
      join(userDataDir, 'Default', basename),
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
    return null;
  };
  const wsFile = findStoreFile('workspaces.json');
  if (!wsFile) {
    // eslint-disable-next-line no-console
    console.error('[restore-on-relaunch] userDataDir contents:', readdirSync(userDataDir));
    throw new Error(`workspaces.json not found under ${userDataDir} — h1 didn't persist`);
  }
  const persistedWorkspaces = JSON.parse(readFileSync(wsFile, 'utf8'));
  expect(
    (persistedWorkspaces.workspaces as Array<{ name: string }>).map((w) => w.name),
  ).toContain('Sticky');

  // Second launch with the same userDataDir
  const h2 = await launchApp({ userDataDir });
  try {
    // Polling the store via the e2e seam is the canonical "did hydrate
    // finish?" check — cheaper than `toBeVisible` polling DOM, and
    // immune to render-throttling under CI xvfb contention. The
    // workspace button is downstream of `store.workspaces.length > 0`,
    // so waiting for the underlying state to land first lets the next
    // assertion run at a normal 15s timeout instead of needing a long
    // overall ceiling. This test has flaked at 30s and 60s timeouts
    // for weeks; switching to a store-state wait is the structural fix.
    await h2.shell.waitForFunction(
      () => {
        const store = (globalThis as { __test_useShellStore?: { getState: () => { workspaces: unknown[] } } }).__test_useShellStore;
        return Boolean(store && store.getState().workspaces.length > 0);
      },
      undefined,
      { timeout: 90_000 },
    );

    // Dump diagnostic state if the button assertion fails — the trace
    // is otherwise opaque (we just know "element not found"). Wrap the
    // expect so we can log the store contents alongside the throw.
    try {
      await expect(h2.shell.getByRole('button', { name: /open instance sticky/i })).toBeVisible();
      await expect(h2.shell.getByRole('tab', { name: /survives-restart/ })).toBeVisible();
    } catch (err) {
      const diag = await h2.shell.evaluate(() => {
        // page.evaluate runs in the browser, but the e2e tsconfig only
        // ships ES2022 (no DOM lib). Cast through globalThis to reach
        // browser-only globals.
        const g = globalThis as {
          __test_useShellStore?: { getState: () => unknown };
          document?: {
            body?: { innerText?: string };
            querySelectorAll: (sel: string) => Array<{ getAttribute(name: string): string | null }>;
          };
        };
        const store = g.__test_useShellStore;
        const doc = g.document;
        return {
          storeState: store ? store.getState() : null,
          bodyText: (doc?.body?.innerText ?? '').slice(0, 2000),
          openDialogs: doc
            ? Array.from(doc.querySelectorAll('[role="dialog"]')).map((d) => d.getAttribute('aria-labelledby'))
            : [],
        };
      }).catch(() => null);
      // eslint-disable-next-line no-console
      console.error('[restore-on-relaunch] failed; renderer state:', JSON.stringify(diag, null, 2));
      throw err;
    }
  } finally {
    await h2.app.close();
    rmSync(userDataDir, { recursive: true, force: true });
  }
});
