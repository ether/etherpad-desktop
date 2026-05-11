import { wrapHandler } from './dispatcher.js';
import { z } from 'zod';
import type { WorkspaceStore } from '../workspaces/workspace-store.js';
import type { SettingsStore } from '../settings/settings-store.js';
import type { PadHistoryStore } from '../pads/pad-history-store.js';
import type { PadHistoryEntry } from '@shared/types/pad-history';

export function stateHandlers(deps: {
  workspaces: WorkspaceStore;
  settings: SettingsStore;
  padHistory: PadHistoryStore;
}) {
  return {
    getInitial: wrapHandler('state.getInitial', z.object({}), async () => {
      // Pre-bundle pad history for every known workspace so the sidebar's
      // "Recent" / "Pinned" lists render immediately on first launch. Before
      // this, the renderer started with an empty `padHistory` map and only
      // fetched per-workspace entries after a `padHistory.touch` event,
      // which meant the sidebar appeared empty until the user opened a pad.
      const workspaces = deps.workspaces.list();
      const padHistory: Record<string, PadHistoryEntry[]> = {};
      for (const ws of workspaces) {
        padHistory[ws.id] = deps.padHistory.listForWorkspace(ws.id);
      }
      return {
        workspaces,
        workspaceOrder: deps.workspaces.order(),
        settings: deps.settings.get(),
        padHistory,
      };
    }),
  };
}
