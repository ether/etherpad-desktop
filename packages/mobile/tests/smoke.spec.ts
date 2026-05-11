import { test, expect } from '@playwright/test';

test('mobile bundle boots: shell mounts and shows the first-launch AddWorkspaceDialog', async ({ page }) => {
  await page.goto('/');
  // The shell auto-opens the non-dismissable AddWorkspaceDialog when
  // initial.workspaces.length === 0 — which is exactly the stub Platform's
  // first-launch state. The dialog's H2 reads "Add an Etherpad instance".
  const heading = page.getByRole('heading', { name: /add an etherpad instance/i });
  await expect(heading).toBeVisible({ timeout: 15_000 });
});
