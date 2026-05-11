import { test, expect } from '@playwright/test';

const WS_ID = '00000000-0000-4000-8000-000000000001';

// Hard-coded UUID — addInitScript serialises this function's source, so it
// can't close over Node-side constants.
function seedWorkspace(): void {
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
}

test('mobile bundle boots: shell mounts and shows the first-launch AddWorkspaceDialog', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
  await page.goto('/');
  const heading = page.getByRole('heading', { name: /add an etherpad instance/i });
  await expect(heading).toBeVisible({ timeout: 15_000 });
});

test('persisted workspaces hydrate the rail and skip the empty-state dialog', async ({ page }) => {
  await page.addInitScript(seedWorkspace);
  await page.goto('/');

  await expect(
    page.getByRole('button', { name: /open instance acme/i }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole('heading', { name: /add an etherpad instance/i }),
  ).not.toBeVisible();
});

test('opening a pad mounts an iframe in PadIframeStack with the right src + lang', async ({ page }) => {
  await page.addInitScript(seedWorkspace);
  await page.goto('/');

  // Wait for the rail (= hydrate finished) before driving the platform.
  await expect(
    page.getByRole('button', { name: /open instance acme/i }),
  ).toBeVisible({ timeout: 15_000 });

  // Drive the platform directly — going through the OpenPadDialog adds
  // friction without testing anything new at this layer.
  await page.evaluate(async ({ wsId }) => {
    const platform = (window as unknown as { __test_platform: {
      tab: {
        open(input: { workspaceId: string; padName: string; mode?: 'open' | 'create' }): Promise<unknown>;
      };
    } }).__test_platform;
    await platform.tab.open({ workspaceId: wsId, padName: 'hello' });
  }, { wsId: WS_ID });

  // PadIframeStack should render an iframe whose data-pad-id matches the
  // synthesised tab id (workspaceId::padName), with the correct src.
  const tabId = `${WS_ID}::hello`;
  const iframe = page.locator(`iframe[data-pad-id="${tabId}"]`);
  await expect(iframe).toBeAttached({ timeout: 5_000 });
  await expect(iframe).toHaveAttribute('src', 'https://acme.example/p/hello?lang=en');
  // Visible because it's the active tab and no dialog is open.
  await expect(iframe).toBeVisible();
});

test('opening a dialog hides every pad iframe', async ({ page }) => {
  await page.addInitScript(seedWorkspace);
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: /open instance acme/i }),
  ).toBeVisible({ timeout: 15_000 });

  await page.evaluate(async ({ wsId }) => {
    const platform = (window as unknown as { __test_platform: {
      tab: {
        open(input: { workspaceId: string; padName: string }): Promise<unknown>;
      };
    } }).__test_platform;
    await platform.tab.open({ workspaceId: wsId, padName: 'hello' });
  }, { wsId: WS_ID });

  const tabId = `${WS_ID}::hello`;
  const iframe = page.locator(`iframe[data-pad-id="${tabId}"]`);
  await expect(iframe).toBeVisible({ timeout: 5_000 });

  // Open the Settings dialog via the rail cog (no need to load real settings
  // — the dialog itself is what we're verifying hides iframes).
  await page.getByRole('button', { name: /settings/i }).first().click();
  await expect(
    page.getByRole('heading', { name: /^settings$/i }),
  ).toBeVisible({ timeout: 5_000 });
  await expect(iframe).toBeHidden();
});
