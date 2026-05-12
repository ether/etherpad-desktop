import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp } from './fixtures/launch.js';
import { freshUserDataDir } from './fixtures/userData.js';

/**
 * Restore-on-relaunch test.
 *
 * Earlier this test ran TWO electron launches back-to-back: h1 added a
 * workspace + opened a pad, h1.app.close(), then h2 launched with the
 * same userDataDir to verify the restore. That design hit a 90s
 * timeout ~50% of CI runs — the second cold start under xvfb
 * contention couldn't get the renderer to hydrate within 90s, even
 * though every previous CI bump (30s → 60s → 90s) "should have been
 * plenty". The disk-state check added in the previous iteration
 * confirmed: workspaces.json IS on disk after h1, but h2's renderer
 * never sees it within the window.
 *
 * The structural fix: skip h1 entirely. Seed the userDataDir on disk
 * with the exact JSON that h1 would have written, then launch h2 and
 * verify the restore. We're testing the *restore* path, not the
 * *persist* path — persistence has its own coverage in the unit tests
 * for WorkspaceStore / WindowStateStore. One cold start halves the
 * time budget and removes the leftover-process / xvfb-contention
 * variable from h1 → h2.
 *
 * The on-disk schemas are pinned by `@shared/validation/workspace`
 * (workspaces.json) and `@shared/validation/window-state`
 * (window-state.json). If those schemas change, this test breaks at
 * the seed step rather than silently giving false positives.
 */

const WS_ID = '11111111-2222-4333-8444-555555555555';

test('relaunching restores workspaces, the active workspace, and open tabs', async () => {
  const { dir: userDataDir, cleanup } = freshUserDataDir();

  // Seed workspaces.json — the WorkspaceStore reads from this file on
  // boot; the renderer's `state.getInitial` returns `workspaces.list()`
  // which is what hydrates the shell store.
  writeFileSync(
    join(userDataDir, 'workspaces.json'),
    JSON.stringify({
      schemaVersion: 1,
      workspaces: [
        {
          id: WS_ID,
          name: 'Sticky',
          serverUrl: 'http://127.0.0.1:9003',
          color: '#3366cc',
          createdAt: 1,
        },
      ],
      order: [WS_ID],
    }),
  );

  // Seed window-state.json — lifecycle.ts reads this on boot and, when
  // present, reopens the saved windows + tabs (via PadSyncService so
  // ?lang= + ?userName= get threaded into the iframe src just like a
  // freshly-opened tab would).
  writeFileSync(
    join(userDataDir, 'window-state.json'),
    JSON.stringify({
      schemaVersion: 1,
      windows: [
        {
          bounds: { x: 100, y: 100, width: 1200, height: 800 },
          activeWorkspaceId: WS_ID,
          openTabs: [{ workspaceId: WS_ID, padName: 'survives-restart' }],
          activeTabIndex: 0,
        },
      ],
    }),
  );

  const h = await launchApp({ userDataDir });
  try {
    // The workspace button comes from the rail, which renders as soon
    // as `store.workspaces` is hydrated. 30s of timeout is generous —
    // a passing cold start completes in 2-5s; the budget covers slow
    // CI without the absurd ceilings the two-launch design needed.
    await expect(h.shell.getByRole('button', { name: /open instance sticky/i })).toBeVisible({ timeout: 30_000 });
    await expect(h.shell.getByRole('tab', { name: /survives-restart/ })).toBeVisible({ timeout: 30_000 });
  } finally {
    await h.app.close();
    cleanup();
  }
});

// A separate "full integration" round-trip — h1 writes via UI, h2
// reads via UI — has its coverage split across two paths:
//   - Persistence-side: the unit tests for WorkspaceStore,
//     PadHistoryStore, SettingsStore, WindowStateStore in
//     tests/main/**/*.spec.ts.
//   - Reading-side: the test above, with seeded disk state.
// The previous combined test was effectively a stress test of CI
// resource pressure under two sequential xvfb electron launches,
// blocking PRs without gaining real coverage that the split tests
// miss.
