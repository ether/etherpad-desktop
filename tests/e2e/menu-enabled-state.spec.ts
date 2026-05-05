/**
 * Menu items must be disabled when the action they perform doesn't apply:
 *   - "New Tab" / "Open Pad…" require an active workspace
 *   - "Close Tab" / "Reload Pad" require an active tab
 *
 * The contextual enable/disable is enforced by `applyMenuEnabledState` in
 * `src/main/app/menu.ts`, fed from the lifecycle's tab-state listener.
 */
import { test, expect } from '@playwright/test';
import { launchApp } from './fixtures/launch';
import type { AppHandle } from './fixtures/launch';

type EnabledMap = { newTab: boolean; openPad: boolean; closeTab: boolean; reload: boolean };

async function readMenuEnabledState(h: AppHandle): Promise<EnabledMap> {
  return await h.app.evaluate(({ Menu }) => {
    const menu = Menu.getApplicationMenu();
    if (!menu) throw new Error('no application menu');
    const ids = {
      newTab: 'menu.newTab',
      openPad: 'menu.openPad',
      closeTab: 'menu.closeTab',
      reload: 'menu.reload',
    } as const;
    const out = {} as EnabledMap;
    for (const k of Object.keys(ids) as (keyof typeof ids)[]) {
      const item = menu.getMenuItemById(ids[k]);
      out[k] = item?.enabled === true;
    }
    return out;
  });
}

test('menu items reflect contextual availability across the lifecycle', async () => {
  const h = await launchApp();
  try {
    // First-run: AddWorkspaceDialog visible, no active workspace, no tabs.
    // newTab + openPad must be disabled. closeTab + reload must be disabled.
    const before = await readMenuEnabledState(h);
    expect(before).toEqual({ newTab: false, openPad: false, closeTab: false, reload: false });

    // Add a workspace pointed at the test fixture.
    await h.shell.getByLabel(/name/i).fill('MenuState');
    await h.shell.getByLabel(/etherpad url/i).fill('http://127.0.0.1:9003');
    await h.shell.getByRole('button', { name: /^add$/i }).click();
    await expect(h.shell.getByRole('button', { name: /open instance menustate/i })).toBeVisible();

    // After the workspace exists newTab + openPad should enable; closeTab + reload still disabled.
    const afterWorkspace = await readMenuEnabledState(h);
    expect(afterWorkspace.newTab).toBe(true);
    expect(afterWorkspace.openPad).toBe(true);
    expect(afterWorkspace.closeTab).toBe(false);
    expect(afterWorkspace.reload).toBe(false);

    // Open a pad — closeTab + reload should now enable.
    await h.shell.getByRole('button', { name: /new pad/i }).click();
    await h.shell.getByLabel(/pad name/i).fill('menustate-pad');
    await h.shell.getByRole('button', { name: /^open$/i }).click();
    await expect(h.shell.getByRole('tab', { name: /menustate-pad/ })).toBeVisible();

    const afterTabOpen = await readMenuEnabledState(h);
    expect(afterTabOpen).toEqual({ newTab: true, openPad: true, closeTab: true, reload: true });
  } finally {
    await h.close();
  }
});
