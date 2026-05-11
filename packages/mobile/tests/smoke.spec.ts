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

  await expect(
    page.getByRole('button', { name: /open instance acme/i }),
  ).toBeVisible({ timeout: 15_000 });

  await page.evaluate(async ({ wsId }) => {
    const platform = (window as unknown as { __test_platform: {
      tab: {
        open(input: { workspaceId: string; padName: string; mode?: 'open' | 'create' }): Promise<unknown>;
      };
    } }).__test_platform;
    await platform.tab.open({ workspaceId: wsId, padName: 'hello' });
  }, { wsId: WS_ID });

  const tabId = `${WS_ID}::hello`;
  const iframe = page.locator(`iframe[data-pad-id="${tabId}"]`);
  await expect(iframe).toBeAttached({ timeout: 5_000 });
  await expect(iframe).toHaveAttribute('src', 'https://acme.example/p/hello?lang=en');
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
      tab: { open(input: { workspaceId: string; padName: string }): Promise<unknown> };
    } }).__test_platform;
    await platform.tab.open({ workspaceId: wsId, padName: 'hello' });
  }, { wsId: WS_ID });

  const tabId = `${WS_ID}::hello`;
  const iframe = page.locator(`iframe[data-pad-id="${tabId}"]`);
  await expect(iframe).toBeVisible({ timeout: 5_000 });

  await page.getByRole('button', { name: /settings/i }).first().click();
  await expect(
    page.getByRole('heading', { name: /^settings$/i }),
  ).toBeVisible({ timeout: 5_000 });
  await expect(iframe).toBeHidden();
});

test('share + external-browser actions appear over the active pad', async ({ page }) => {
  await page.addInitScript(seedWorkspace);
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: /open instance acme/i }),
  ).toBeVisible({ timeout: 15_000 });

  // No active tab → no actions overlay.
  await expect(page.getByTestId('pad-actions-overlay')).toHaveCount(0);

  await page.evaluate(async ({ wsId }) => {
    const platform = (window as unknown as { __test_platform: {
      tab: { open(input: { workspaceId: string; padName: string }): Promise<unknown> };
    } }).__test_platform;
    await platform.tab.open({ workspaceId: wsId, padName: 'hello' });
  }, { wsId: WS_ID });

  const overlay = page.getByTestId('pad-actions-overlay');
  await expect(overlay).toBeVisible({ timeout: 5_000 });
  await expect(overlay.getByRole('button', { name: /share pad url/i })).toBeVisible();
  await expect(overlay.getByRole('button', { name: /open in external browser/i })).toBeVisible();
});

test('deep link to a known workspace opens the pad in that workspace', async ({ page }) => {
  await page.addInitScript(seedWorkspace);
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: /open instance acme/i }),
  ).toBeVisible({ timeout: 15_000 });

  // Simulate the Capacitor `appUrlOpen` event by invoking the deep-link
  // handler exposed on window. main.tsx wires it like __test_platform.
  await page.evaluate(() => {
    (window as unknown as { __test_handleUrl: (url: string) => void })
      .__test_handleUrl('https://acme.example/p/deep-linked');
  });

  const tabId = `${WS_ID}::deep-linked`;
  await expect(page.locator(`iframe[data-pad-id="${tabId}"]`)).toBeAttached({ timeout: 5_000 });
});
