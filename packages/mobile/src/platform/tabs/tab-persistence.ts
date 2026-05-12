import { z } from 'zod';
import type { OpenTab } from '@shared/types/tab';
import { loadJson, saveJson } from '../storage/preferences.js';

/**
 * Persisted "what was open last time" — restored on app boot so closing
 * and re-opening the app puts the user back on the pad they were on.
 *
 * Tab state on mobile is otherwise ephemeral (per the original Phase 5
 * design). This module adds an opt-out point: when settings.rememberOpenTabsOnQuit
 * is true (the default), every tab mutation writes through here.
 */

const KEY = 'etherpad:windowState';

// We persist only the identifying fields; transient state (loading/loaded,
// errorMessage, title once fetched) gets re-derived when the iframe loads.
const persistedTabSchema = z.object({
  tabId: z.string(),
  workspaceId: z.string().uuid(),
  padName: z.string().min(1).max(200),
});

// `railCollapsed` is optional so older persisted payloads still validate.
const fileSchema = z.object({
  schemaVersion: z.literal(1),
  tabs: z.array(persistedTabSchema),
  activeTabId: z.string().nullable(),
  activeWorkspaceId: z.string().uuid().nullable(),
  railCollapsed: z.boolean().optional(),
});

export type WindowState = {
  tabs: Array<{ tabId: string; workspaceId: string; padName: string }>;
  activeTabId: string | null;
  activeWorkspaceId: string | null;
  railCollapsed: boolean;
};

export async function load(): Promise<WindowState> {
  const stored = await loadJson(KEY, fileSchema);
  return stored
    ? {
        tabs: stored.tabs,
        activeTabId: stored.activeTabId,
        activeWorkspaceId: stored.activeWorkspaceId,
        railCollapsed: stored.railCollapsed ?? false,
      }
    : { tabs: [], activeTabId: null, activeWorkspaceId: null, railCollapsed: false };
}

export async function save(state: WindowState): Promise<void> {
  await saveJson(KEY, fileSchema, {
    schemaVersion: 1,
    tabs: state.tabs.map((t) => ({
      tabId: t.tabId,
      workspaceId: t.workspaceId,
      padName: t.padName,
    })),
    activeTabId: state.activeTabId,
    activeWorkspaceId: state.activeWorkspaceId,
    railCollapsed: state.railCollapsed,
  });
}

/** Test seam: helper to apply a persisted set to the tab map + activeId. */
export function hydrateTabs(
  persisted: WindowState,
): { tabs: Map<string, OpenTab>; activeTabId: string | null } {
  const tabs = new Map<string, OpenTab>();
  for (const t of persisted.tabs) {
    tabs.set(t.tabId, {
      tabId: t.tabId,
      workspaceId: t.workspaceId,
      padName: t.padName,
      title: t.padName,
      state: 'loading',
    });
  }
  return { tabs, activeTabId: persisted.activeTabId };
}
