// tests/e2e/embedded-workspace.spec.ts
//
// This test exercises creating a local (embedded) Etherpad workspace.
// It uses `npx etherpad-lite@latest` which downloads Etherpad on a clean
// machine (~100MB) and can take 60-180s on first run. On CI without npx
// cache warmth the test would time out, so it is marked test.skip here.
// The unit-level coverage in tests/main/embedded/ and
// tests/main/ipc/workspace-handlers.spec.ts covers the logic paths.
//
// To run locally (after `npx etherpad-lite@latest` is cached):
//   E2E_EMBEDDED=1 pnpm test:e2e --grep "embedded workspace"

import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch';

const RUN_EMBEDDED = Boolean(process.env.E2E_EMBEDDED);

test.describe.serial('embedded workspace', () => {
  test.setTimeout(300_000);

  test('user can create a local workspace and open a pad in it', async () => {
    test.skip(!RUN_EMBEDDED, 'Skipped: set E2E_EMBEDDED=1 to run (requires npx cache warmth)');

    const h = await launchApp();
    try {
      // The first-run AddWorkspaceDialog should be showing
      await h.shell.getByLabel(/name/i).fill('Local');

      // Toggle the embedded checkbox
      await h.shell.getByRole('checkbox', { name: /use a local etherpad server/i }).click();

      // URL field should be gone
      await expect(h.shell.getByLabel(/etherpad url/i)).not.toBeVisible();

      // Click Add — this starts the embedded server which may take several minutes on first run
      await h.shell.getByRole('button', { name: /^add$/i }).click();

      // The embedded server takes time to start on a cold cache; allow up to 4 minutes.
      await expect(
        h.shell.getByRole('button', { name: /open workspace local/i }),
      ).toBeVisible({ timeout: 240_000 });

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
