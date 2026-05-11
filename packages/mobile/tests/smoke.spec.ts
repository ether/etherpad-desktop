import { test, expect } from '@playwright/test';

test('mobile bundle boots: shell mounts and shows the first-launch AddWorkspaceDialog', async ({ page }) => {
  // No persisted state → AddWorkspaceDialog opens by design.
  await page.addInitScript(() => {
    localStorage.clear();
  });
  await page.goto('/');
  const heading = page.getByRole('heading', { name: /add an etherpad instance/i });
  await expect(heading).toBeVisible({ timeout: 15_000 });
});

test('persisted workspaces hydrate the rail and skip the empty-state dialog', async ({ page }) => {
  // Seed Capacitor Preferences (web fallback = localStorage with CapacitorStorage. prefix).
  await page.addInitScript(() => {
    const wsFile = {
      schemaVersion: 1,
      workspaces: [
        {
          id: '00000000-0000-4000-8000-000000000001',
          name: 'Acme',
          serverUrl: 'https://acme.example/',
          color: '#3366cc',
          createdAt: 1,
        },
      ],
      order: ['00000000-0000-4000-8000-000000000001'],
    };
    localStorage.setItem('CapacitorStorage.etherpad:workspaces', JSON.stringify(wsFile));
  });
  await page.goto('/');

  // Rail shows the workspace; AddWorkspaceDialog is NOT visible.
  await expect(
    page.getByRole('button', { name: /open instance acme/i }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole('heading', { name: /add an etherpad instance/i }),
  ).not.toBeVisible();
});
