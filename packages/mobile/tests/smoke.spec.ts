import { test, expect, type Page } from '@playwright/test';

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

async function openPad(page: Page, wsId: string, padName: string): Promise<void> {
  await page.evaluate(async ([id, name]) => {
    const platform = (window as unknown as { __test_platform: {
      tab: {
        open(input: { workspaceId: string; padName: string; mode?: 'open' | 'create' }): Promise<unknown>;
      };
    } }).__test_platform;
    await platform.tab.open({ workspaceId: id!, padName: name! });
  }, [wsId, padName] as const);
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

  await openPad(page, WS_ID, 'hello');

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

  await openPad(page, WS_ID, 'hello');

  const tabId = `${WS_ID}::hello`;
  const iframe = page.locator(`iframe[data-pad-id="${tabId}"]`);
  await expect(iframe).toBeVisible({ timeout: 5_000 });

  // The rail auto-collapses on tab.open (Phase 7 UX), so the rail-side
  // settings cog isn't directly clickable. Expand the rail via the
  // collapse handle first ("Show instances" when collapsed).
  await page.getByRole('button', { name: /show instances/i }).click();
  await page.getByRole('button', { name: /settings/i }).first().click();
  await expect(
    page.getByRole('heading', { name: /^settings$/i }),
  ).toBeVisible({ timeout: 5_000 });
  await expect(iframe).toBeHidden();
});

test('deep link to a known workspace opens the pad in that workspace', async ({ page }) => {
  await page.addInitScript(seedWorkspace);
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: /open instance acme/i }),
  ).toBeVisible({ timeout: 15_000 });

  await page.evaluate(() => {
    (window as unknown as { __test_handleUrl: (url: string) => void })
      .__test_handleUrl('https://acme.example/p/deep-linked');
  });

  const tabId = `${WS_ID}::deep-linked`;
  await expect(page.locator(`iframe[data-pad-id="${tabId}"]`)).toBeAttached({ timeout: 5_000 });
});

// --- Phase 7 fixes ---

test('opening a pad auto-collapses the workspace rail (mobile UX)', async ({ page }) => {
  await page.addInitScript(seedWorkspace);
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: /open instance acme/i }),
  ).toBeVisible({ timeout: 15_000 });

  // Before tab.open the rail-collapsed wrapper class is absent.
  await expect(page.locator('.shell-root-wrapper')).not.toHaveClass(/rail-collapsed/);

  await openPad(page, WS_ID, 'hello');

  // After tab.open the wrapper picks up the collapsed class so the pad
  // gets the full screen on phones.
  await expect(page.locator('.shell-root-wrapper')).toHaveClass(/rail-collapsed/, {
    timeout: 5_000,
  });
});

test('opening a pad populates pad-history so QuickSwitcher can find it', async ({ page }) => {
  await page.addInitScript(seedWorkspace);
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: /open instance acme/i }),
  ).toBeVisible({ timeout: 15_000 });

  await openPad(page, WS_ID, 'recent-search-target');

  // Capacitor Preferences web-fallback writes to localStorage with the
  // CapacitorStorage. prefix; reading it directly confirms the store
  // persisted the pad — same data the shell's onPadHistoryChanged handler
  // will pull via padHistory.list.
  const padHistory = await page.evaluate((wsId) => {
    const key = `CapacitorStorage.etherpad:padHistory:${wsId}`;
    return JSON.parse(localStorage.getItem(key) ?? '{}');
  }, WS_ID);
  expect(padHistory.entries).toBeDefined();
  expect((padHistory.entries as Array<{ padName: string }>).some((e) => e.padName === 'recent-search-target')).toBe(true);
});

test('settings.userName threads into the iframe src as ?userName=', async ({ page }) => {
  await page.addInitScript(seedWorkspace);
  await page.addInitScript(() => {
    const settings = {
      schemaVersion: 1,
      defaultZoom: 1,
      accentColor: '#3366cc',
      language: 'en',
      rememberOpenTabsOnQuit: true,
      minimizeToTray: false,
      themePreference: 'auto',
      userName: 'Jose',
    };
    localStorage.setItem('CapacitorStorage.etherpad:settings', JSON.stringify(settings));
  });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: /open instance acme/i }),
  ).toBeVisible({ timeout: 15_000 });

  await openPad(page, WS_ID, 'who-am-i');

  const tabId = `${WS_ID}::who-am-i`;
  const iframe = page.locator(`iframe[data-pad-id="${tabId}"]`);
  await expect(iframe).toHaveAttribute('src', 'https://acme.example/p/who-am-i?lang=en&userName=Jose');
});

// X-Frame-Options DENY / SAMEORIGIN detection from pure JS is unreliable
// — Chromium fires `onLoad` for blocked iframes too. The robust escape hatch
// lives in the native WebChromeClient hook scheduled for Phase 6b. No test
// here because there's nothing accurate to assert in browser context.
