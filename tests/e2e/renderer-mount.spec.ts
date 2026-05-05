/**
 * Fast-fail smoke test: assert that the React shell mounts within a few
 * seconds of launch.
 *
 * Why this exists: when the preload bundle breaks (e.g. a transitive dep
 * fails to resolve, leaving `window.etherpadDesktop` undefined), every other
 * E2E test slowly times out at 30s while looking for UI elements. This test
 * fails in <5s with a clear signal that the renderer never bootstrapped —
 * making the failure mode legible at a glance.
 *
 * Specifically guards against:
 *   - Preload bundle externalising a node_modules dep that can't load in
 *     sandbox (window.etherpadDesktop undefined → silent renderer crash).
 *   - CSP blocking inline / crossorigin module scripts.
 *   - Missing entry-point assets after a Vite bundling regression.
 *
 * If this test ever fails, the cause is almost certainly in the build /
 * preload / CSP layer, not in any one feature.
 */
import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch';

test('shell renderer mounts and exposes window.etherpadDesktop', async () => {
  const h = await launchApp();
  try {
    // 1. Preload-side: window.etherpadDesktop must exist before any UI test
    //    can hope to drive the app. If this is undefined the preload bundle
    //    failed to load (most often because a node_module require()'d at
    //    runtime in the sandboxed preload context).
    const bridge = await h.shell.evaluate(() => {
      // Returning the keys (instead of the api object itself) avoids any
      // serialization issues with bound functions. Cast through globalThis
      // because the e2e tsconfig has no DOM lib.
      const w = globalThis as unknown as { etherpadDesktop?: Record<string, unknown> };
      const api = w.etherpadDesktop;
      if (!api) return null;
      return Object.keys(api).sort();
    });
    expect(bridge, 'window.etherpadDesktop is undefined — preload bundle broken').not.toBeNull();
    expect(bridge).toEqual(
      expect.arrayContaining(['workspace', 'tab', 'window', 'padHistory', 'settings', 'state', 'events']),
    );

    // 2. Renderer-side: the React tree must mount within a generous-but-not-
    //    infinite window. The shell renders the workspace rail at the top
    //    level regardless of state, so it's the canonical "did React mount"
    //    sentinel.
    await expect(h.shell.getByRole('navigation', { name: /etherpad instance rail/i })).toBeVisible({ timeout: 10_000 });

    // 3. The first-run dialog OR the rail's add button is visible — i.e.,
    //    one of the two valid initial states. If both are absent the
    //    renderer is in a broken in-between state.
    const dialogVisible = await h.shell.getByRole('dialog').isVisible().catch(() => false);
    const railAddVisible = await h.shell.getByRole('button', { name: /add etherpad instance/i }).isVisible().catch(() => false);
    expect(
      dialogVisible || railAddVisible,
      'Neither the AddWorkspaceDialog nor the rail "+ add" button is visible — renderer is in a broken state',
    ).toBe(true);
  } finally {
    await h.close();
  }
});
