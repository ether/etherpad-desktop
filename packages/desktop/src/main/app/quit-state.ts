import type { WindowState } from '@shared/types/window-state';

/**
 * Build the WindowState payload for `before-quit`. Skips destroyed windows so
 * we don't crash with `TypeError: Object has been destroyed` when iterating
 * windows the user already closed.
 *
 * Pure function — no Electron import — so it can be tested standalone.
 */
export type AppWindowLike = {
  window: { isDestroyed(): boolean };
  bounds(): { x: number; y: number; width: number; height: number };
  tabManager: {
    getActiveWorkspaceId(): string | null;
    listAll(): Array<{ workspaceId: string; padName: string }>;
  };
};

export function serializeWindowsForQuit(wins: readonly AppWindowLike[]): WindowState {
  const live = wins.filter((w) => !w.window.isDestroyed());
  return {
    schemaVersion: 1,
    windows: live.map((w) => ({
      bounds: w.bounds(),
      activeWorkspaceId: w.tabManager.getActiveWorkspaceId(),
      openTabs: w.tabManager.listAll().map((t) => ({ workspaceId: t.workspaceId, padName: t.padName })),
      activeTabIndex: 0,
    })),
  };
}
