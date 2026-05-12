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

test('opening a pad then reloading restores the same pad (full write+read cycle)', async ({ page }) => {
  // Simulates the device-side bug the user reported: open pad → kill app
  // → reopen → expect to be back on the pad. The reload here is the
  // closest in-browser analogue to "kill + relaunch" — same JS context
  // boundary, same Preferences read on init.
  await page.addInitScript(seedWorkspace);
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: /open instance acme/i }),
  ).toBeVisible({ timeout: 15_000 });

  await openPad(page, WS_ID, 'survives-reload');
  const tabId = `${WS_ID}::survives-reload`;
  await expect(page.locator(`iframe[data-pad-id="${tabId}"]`)).toBeAttached({ timeout: 5_000 });

  // Reload the page — simulates app kill + relaunch. The persisted
  // windowState should restore the tab.
  await page.reload();

  // After reload, no AddWorkspaceDialog (workspace persists) AND the
  // pad iframe is back.
  await expect(
    page.getByRole('heading', { name: /add an etherpad instance/i }),
  ).not.toBeVisible();
  const restoredIframe = page.locator(`iframe[data-pad-id="${tabId}"]`);
  await expect(restoredIframe).toBeAttached({ timeout: 15_000 });
  await expect(restoredIframe).toHaveAttribute('src', /\/p\/survives-reload\?lang=/);
});

test('persisted windowState restores the active pad on reopen', async ({ page }) => {
  // Seed BOTH a workspace AND a `windowState` entry simulating a prior
  // session that had an open + active pad. On boot the Capacitor
  // Platform's state.getInitial() should load this through, App.tsx
  // should select the persisted workspace, and tabsChanged should fire
  // with the persisted tab so PadIframeStack renders the iframe.
  await page.addInitScript(seedWorkspace);
  await page.addInitScript(() => {
    const ws = '00000000-0000-4000-8000-000000000001';
    const tabId = `${ws}::restored-pad`;
    localStorage.setItem(
      'CapacitorStorage.etherpad:windowState',
      JSON.stringify({
        schemaVersion: 1,
        tabs: [{ tabId, workspaceId: ws, padName: 'restored-pad' }],
        activeTabId: tabId,
        activeWorkspaceId: ws,
      }),
    );
  });
  await page.goto('/');

  // AddWorkspaceDialog must NOT appear — we have a workspace.
  await expect(
    page.getByRole('heading', { name: /add an etherpad instance/i }),
  ).not.toBeVisible();

  // The restored iframe should be mounted with the right src.
  const tabId = `${WS_ID}::restored-pad`;
  const iframe = page.locator(`iframe[data-pad-id="${tabId}"]`);
  await expect(iframe).toBeAttached({ timeout: 15_000 });
  await expect(iframe).toHaveAttribute('src', 'https://acme.example/p/restored-pad?lang=en');
  await expect(iframe).toBeVisible();
});

test('persisted railCollapsed restores focus mode on reopen', async ({ page }) => {
  // The "tapping pad collapses rail" UX wires through windowState — when
  // the user collapses the rail, we persist the boolean alongside open
  // tabs. On boot, getInitial returns it, App.tsx's hydrate copies it
  // into the store, and the wrapper picks up the `rail-collapsed` class.
  await page.addInitScript(seedWorkspace);
  await page.addInitScript(() => {
    const ws = '00000000-0000-4000-8000-000000000001';
    const tabId = `${ws}::focus-mode`;
    localStorage.setItem(
      'CapacitorStorage.etherpad:windowState',
      JSON.stringify({
        schemaVersion: 1,
        tabs: [{ tabId, workspaceId: ws, padName: 'focus-mode' }],
        activeTabId: tabId,
        activeWorkspaceId: ws,
        railCollapsed: true,
      }),
    );
  });
  await page.goto('/');
  // App.tsx applies the rail-collapsed class on hydrate.
  await expect(page.locator('.shell-root-wrapper')).toHaveClass(/rail-collapsed/, {
    timeout: 5_000,
  });
});

test('stored railCollapsed is ignored when there are no open pads', async ({ page }) => {
  // The stored preference is the user's intent, but "focus mode" only
  // makes sense when there's a pad to focus on. On boot with rail-
  // collapsed=true and no tabs, the rail should still render — otherwise
  // the user lands on a mostly-empty screen with no obvious way to add
  // a pad. Seed BOTH the workspace and a stored railCollapsed=true with
  // ZERO persisted tabs.
  await page.addInitScript(seedWorkspace);
  await page.addInitScript(() => {
    localStorage.setItem(
      'CapacitorStorage.etherpad:windowState',
      JSON.stringify({
        schemaVersion: 1,
        tabs: [],
        activeTabId: null,
        activeWorkspaceId: '00000000-0000-4000-8000-000000000001',
        railCollapsed: true,
      }),
    );
  });
  await page.goto('/');
  // Workspace button is in the rail — must be visible.
  await expect(
    page.getByRole('button', { name: /open instance acme/i }),
  ).toBeVisible({ timeout: 15_000 });
  // Wrapper does NOT pick up the collapsed class.
  await expect(page.locator('.shell-root-wrapper')).not.toHaveClass(/rail-collapsed/);
});

test('closing the last open pad auto-restores the rail', async ({ page }) => {
  // Open pad → rail auto-collapses (Phase 7 UX). Close the pad → rail
  // should come back, since "focus mode" has no target. The stored
  // railCollapsed value can stay true; the effective render flips.
  await page.addInitScript(seedWorkspace);
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: /open instance acme/i }),
  ).toBeVisible({ timeout: 15_000 });

  await openPad(page, WS_ID, 'collapse-then-close');
  await expect(page.locator('.shell-root-wrapper')).toHaveClass(/rail-collapsed/);

  // Close the tab via the platform API (matches what the tab-strip x
  // button does — close last open pad).
  const tabId = `${WS_ID}::collapse-then-close`;
  await page.evaluate((id) => {
    const platform = (window as unknown as { __test_platform: {
      tab: { close(input: { tabId: string }): Promise<unknown> };
    } }).__test_platform;
    return platform.tab.close({ tabId: id });
  }, tabId);

  // No tabs → effective collapsed flips to false even though stored
  // preference is still true. Rail visible, workspace button hittable.
  await expect(page.locator('.shell-root-wrapper')).not.toHaveClass(/rail-collapsed/, {
    timeout: 5_000,
  });
  await expect(page.getByRole('button', { name: /open instance acme/i })).toBeVisible();
});

test('opening then closing a pad leaves it in the sidebar Recents list', async ({ page }) => {
  // Regression: the user reported opening a pad, closing it, and seeing
  // nothing in Recents. The localStorage write was happening (covered by
  // the QuickSwitcher pad-history test) but the sidebar never re-rendered
  // because the onPadHistoryChanged → fetch → setPadHistory chain wasn't
  // round-tripping. This test exercises the full flow as the user sees
  // it: pad opens, rail auto-collapses, pad closes, rail re-appears,
  // sidebar should now show the closed pad in Recents.
  await page.addInitScript(seedWorkspace);
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: /open instance acme/i }),
  ).toBeVisible({ timeout: 15_000 });

  await openPad(page, WS_ID, 'recents-after-close');
  const tabId = `${WS_ID}::recents-after-close`;
  await expect(page.locator(`iframe[data-pad-id="${tabId}"]`)).toBeAttached({ timeout: 5_000 });

  // Close the tab via the platform API.
  await page.evaluate((id) => {
    const platform = (window as unknown as { __test_platform: {
      tab: { close(input: { tabId: string }): Promise<unknown> };
    } }).__test_platform;
    return platform.tab.close({ tabId: id });
  }, tabId);

  // No tabs → rail re-appears (effective-collapsed flips to false). The
  // sidebar should then render with "recents-after-close" in the Recents
  // list. Asserting on the rendered DOM, not localStorage — this is what
  // the user actually sees.
  await expect(page.locator('.shell-root-wrapper')).not.toHaveClass(/rail-collapsed/, {
    timeout: 5_000,
  });
  // Scope to the Recent section so we don't match the Pin button
  // (which has the pad name in its aria-label). The pad's "open" button
  // uses the pad name as its accessible text.
  const recents = page.locator('section:has(h3:text("Recent"))');
  await expect(
    recents.getByRole('button', { name: 'recents-after-close', exact: true }),
  ).toBeVisible({ timeout: 5_000 });
});

test('tapping the pad area collapses the rail (mobile drawer dismiss)', async ({ page }) => {
  // Mobile UX: when the rail is expanded AND a pad is showing, tapping
  // the pad area should collapse the rail (focus mode). The capture
  // scrim is a transparent div above the iframes that consumes the
  // first pointer event.
  await page.addInitScript(seedWorkspace);
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: /open instance acme/i }),
  ).toBeVisible({ timeout: 15_000 });

  // Open a pad. The Phase 7 auto-collapse fires here, so we explicitly
  // re-expand the rail to exercise the tap-to-collapse path.
  await openPad(page, WS_ID, 'tap-to-collapse');
  await expect(page.locator('.shell-root-wrapper')).toHaveClass(/rail-collapsed/);
  await page.getByRole('button', { name: /show instances/i }).click();
  await expect(page.locator('.shell-root-wrapper')).not.toHaveClass(/rail-collapsed/);

  // The capture scrim should now be present (rail expanded + pad active).
  const scrim = page.getByTestId('rail-collapse-scrim');
  await expect(scrim).toBeAttached({ timeout: 5_000 });

  // Tap it. The pointer-down handler should collapse the rail and the
  // scrim should unmount itself (it's gated on railCollapsed === false).
  await scrim.click();
  await expect(page.locator('.shell-root-wrapper')).toHaveClass(/rail-collapsed/);
  await expect(scrim).not.toBeAttached();
});

test('QuickSwitcher content search refreshes open pads on every search (live edits visible)', async ({ page }) => {
  // Regression: user opened a pad, typed "Welcome" into it, then
  // searched "Wel" — no results. Root cause: the index fetched at
  // tab.open time was stale by the time the user typed. We now refresh
  // open tabs unconditionally on every search call.
  //
  // The route handler reads a mutable `body` variable so we can change
  // the pad's content AFTER tab.open and verify the next search picks
  // up the new content.
  let liveBody = 'initial empty body';
  await page.route('**/p/live-pad/export/txt', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/plain', body: liveBody });
  });

  await page.addInitScript(seedWorkspace);
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: /open instance acme/i }),
  ).toBeVisible({ timeout: 15_000 });

  // Open the pad — fires the initial (stale, "empty") index.
  await openPad(page, WS_ID, 'live-pad');
  await page.waitForResponse((r) => r.url().includes('/live-pad/export/txt'));

  // Simulate the user typing "Welcome" inside the iframe: the next
  // /export/txt fetch will return the new body.
  liveBody = 'Welcome to my pad!';

  // Open QuickSwitcher and search "Welcome".
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  });
  await expect(page.getByRole('dialog', { name: /quick switcher/i })).toBeVisible({ timeout: 5_000 });
  await page.getByRole('textbox', { name: /quick switcher search input/i }).fill('welcome');

  // The search call re-fetches /export/txt for the open tab and finds
  // "Welcome" in the new body. The content-match row carries a snippet
  // of the matched text.
  const results = page.getByRole('option');
  await expect(results.filter({ hasText: 'Welcome to my pad' })).toHaveCount(1, { timeout: 5_000 });
});

test('QuickSwitcher content search finds pads by what is inside them', async ({ page }) => {
  // Regression: the user opened two pads with "Welcome" in their body,
  // typed "welcome" into the quick switcher, and got nothing. Root
  // cause: capacitor.ts had `searchPadContent: () => Promise.resolve([])`.
  // Mobile now mirrors desktop's pad-content-index: tab.open kicks off
  // a fetch of `/export/txt`, caches the body, and the quick switcher
  // searches across cached texts.
  //
  // We intercept the export endpoint so the test doesn't depend on a
  // real Etherpad. Two pads, each with distinct content containing
  // "Welcome".
  await page.route('**/p/*/export/txt', async (route) => {
    const url = new URL(route.request().url());
    const padName = url.pathname.split('/')[2]; // /p/<name>/export/txt
    const bodies: Record<string, string> = {
      'welcome-pad': 'Welcome to Etherpad! Edit collaboratively.',
      'team-notes': 'Welcome team — sprint notes for this week.',
      'unrelated': 'This pad is about something else entirely.',
    };
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: bodies[padName ?? ''] ?? 'no body',
    });
  });

  await page.addInitScript(seedWorkspace);
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: /open instance acme/i }),
  ).toBeVisible({ timeout: 15_000 });

  // Open all three pads — this triggers tab.open which triggers
  // padContentIndex.index() which fetches and caches the body.
  await openPad(page, WS_ID, 'welcome-pad');
  await openPad(page, WS_ID, 'team-notes');
  await openPad(page, WS_ID, 'unrelated');

  // Give the parallel fetches a beat to complete before searching.
  // The index is fire-and-forget so it's racing tab.open's resolve.
  await page.waitForResponse((r) => r.url().includes('/unrelated/export/txt'));
  await page.waitForTimeout(50);

  // Open the QuickSwitcher and search "welcome".
  await page.evaluate(() => {
    // Dispatch the same keyboard event the user would (Ctrl+K).
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  });
  await expect(page.getByRole('dialog', { name: /quick switcher/i })).toBeVisible({ timeout: 5_000 });
  await page.getByRole('textbox', { name: /quick switcher search input/i }).fill('welcome');

  // The content-search debounce is 200ms in QuickSwitcherDialog; wait
  // for the results list to update beyond the name-match results.
  // Both "welcome-pad" and "team-notes" should appear because both
  // their BODIES contain "Welcome" — even though "team-notes" has no
  // "welcome" in its name. (welcome-pad also matches by name, so it
  // appears at least twice — once as a name hit, once as a content
  // hit with a snippet.)
  const results = page.getByRole('option');
  await expect(results.filter({ hasText: 'team-notes' })).toHaveCount(1, { timeout: 5_000 });
  await expect(results.filter({ hasText: 'welcome-pad' }).first()).toBeVisible();

  // The content-match row carries the body snippet. Pin that path so
  // future regressions in the snippet rendering get caught — not just
  // "did some row appear."
  await expect(results.filter({ hasText: 'Welcome team' })).toHaveCount(1);

  // "unrelated" body has no "welcome" → must not show.
  await expect(results.filter({ hasText: 'unrelated' })).toHaveCount(0);
});

test('content search keeps working when the network goes down (uses cached body)', async ({ page }) => {
  // Offline-resilience pin: the search path refreshes open tabs on
  // every query, but if a refresh fails the previously-cached body
  // stays in the index. So a pad you opened while online stays
  // searchable while offline — just frozen at its last-known content.
  let networkUp = true;
  await page.route('**/p/offline-pad/export/txt', async (route) => {
    if (!networkUp) {
      await route.abort('failed');
      return;
    }
    await route.fulfill({ status: 200, contentType: 'text/plain', body: 'Important offline notes about welcome procedures.' });
  });

  await page.addInitScript(seedWorkspace);
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: /open instance acme/i }),
  ).toBeVisible({ timeout: 15_000 });

  // While "online", open the pad — body gets cached.
  await openPad(page, WS_ID, 'offline-pad');
  await page.waitForResponse((r) => r.url().includes('/offline-pad/export/txt'));

  // Drop the network. Next /export/txt will abort.
  networkUp = false;

  // Search "welcome" — the refresh fetch will fail, but the previous
  // cached body (with "welcome procedures") survives, so the content
  // match still surfaces.
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  });
  await expect(page.getByRole('dialog', { name: /quick switcher/i })).toBeVisible({ timeout: 5_000 });
  await page.getByRole('textbox', { name: /quick switcher search input/i }).fill('welcome');
  const results = page.getByRole('option');
  await expect(results.filter({ hasText: 'welcome procedures' })).toHaveCount(1, { timeout: 5_000 });
});

test('closed pads stay searchable by their last-known content', async ({ page }) => {
  // User flow: open two pads (one body contains "Welcome"), close them
  // both, search "welcome" — expect the welcome-bodied pad to surface
  // using its cached body. Pads-in-history are a real switch target,
  // so the closed-pad path stays in the search index. (Stale-content
  // concerns are addressed by `cache: 'no-store'` on the refresh fetch
  // when the pad is currently open.)
  await page.route('**/p/closed-welcome/export/txt', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/plain', body: 'Welcome aboard the closed pad' });
  });
  await page.route('**/p/closed-other/export/txt', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/plain', body: 'Sprint planning notes here.' });
  });

  await page.addInitScript(seedWorkspace);
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: /open instance acme/i }),
  ).toBeVisible({ timeout: 15_000 });

  // Open both pads, wait for their bodies to be cached, then close both.
  await openPad(page, WS_ID, 'closed-welcome');
  await page.waitForResponse((r) => r.url().includes('/closed-welcome/export/txt'));
  await openPad(page, WS_ID, 'closed-other');
  await page.waitForResponse((r) => r.url().includes('/closed-other/export/txt'));

  await page.evaluate(async (workspaceId) => {
    const platform = (window as unknown as { __test_platform: {
      tab: { close(input: { tabId: string }): Promise<unknown> };
    } }).__test_platform;
    await platform.tab.close({ tabId: `${workspaceId}::closed-welcome` });
    await platform.tab.close({ tabId: `${workspaceId}::closed-other` });
  }, WS_ID);

  // Open QuickSwitcher and search "welcome". Only the welcome-bodied
  // pad should match (via the content-search path — neither pad name
  // contains "welcome").
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  });
  await expect(page.getByRole('dialog', { name: /quick switcher/i })).toBeVisible({ timeout: 5_000 });
  await page.getByRole('textbox', { name: /quick switcher search input/i }).fill('welcome');

  const results = page.getByRole('option');
  await expect(results.filter({ hasText: 'Welcome aboard' })).toHaveCount(1, { timeout: 5_000 });
  // The unrelated closed pad's body doesn't have "welcome" → must not show.
  await expect(results.filter({ hasText: 'Sprint planning' })).toHaveCount(0);
});

// X-Frame-Options DENY / SAMEORIGIN detection from pure JS is unreliable
// — Chromium fires `onLoad` for blocked iframes too. The robust escape hatch
// lives in the native WebChromeClient hook scheduled for Phase 6b. No test
// here because there's nothing accurate to assert in browser context.
