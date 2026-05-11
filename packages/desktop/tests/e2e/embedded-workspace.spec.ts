// tests/e2e/embedded-workspace.spec.ts
//
// This test exercises creating a local (embedded) Etherpad workspace.
// It depends on `pnpm fetch:etherpad` having populated
// `packages/desktop/resources/etherpad/` so the embedded-server spawn
// has source to run. On a fresh clone with bundled source the test
// takes ~30-60s (Etherpad cold-start).
//
// Gated on E2E_EMBEDDED=1 by default — too slow to add to every PR's
// e2e batch. Unit-level coverage in tests/main/embedded/ +
// tests/main/ipc/workspace-handlers.spec.ts covers the logic paths.
//
// To run locally:
//   pnpm --filter @etherpad/desktop fetch:etherpad
//   E2E_EMBEDDED=1 pnpm test:e2e --grep "embedded workspace"

import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch';

const RUN_EMBEDDED = Boolean(process.env.E2E_EMBEDDED);

test.describe.serial('embedded workspace', () => {
  test.setTimeout(180_000);

  test('user can create a local workspace and open a pad in it', async () => {
    test.skip(!RUN_EMBEDDED, 'Skipped: set E2E_EMBEDDED=1 to run (requires fetch:etherpad)');

    const h = await launchApp();
    try {
      // The first-run AddWorkspaceDialog should be showing
      await h.shell.getByLabel(/name/i).fill('Local');

      // Toggle the embedded checkbox — actual label is
      // "Use a local server (runs on this computer)".
      await h.shell.getByRole('checkbox', { name: /use a local server/i }).click();

      // URL field is disabled (not hidden) when embedded is checked.
      await expect(h.shell.getByLabel(/etherpad url/i)).toBeDisabled();

      // Click Add — spawns the bundled Etherpad. Cold-start ~30-60s.
      await h.shell.getByRole('button', { name: /^add$/i }).click();

      await expect(
        h.shell.getByRole('button', { name: /open instance local/i }),
      ).toBeVisible({ timeout: 120_000 });

      // Open a pad
      await h.shell.getByRole('button', { name: /new pad/i }).click();
      await h.shell.getByLabel(/pad name/i).fill('local-test');
      await h.shell.getByRole('button', { name: /^open$/i }).click();
      await expect(h.shell.getByRole('tab', { name: /local-test/ })).toBeVisible();
    } finally {
      await h.close();
    }
  });
});
