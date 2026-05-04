import { wrapHandler } from './dispatcher.js';
import { z } from 'zod';
import type { WorkspaceStore } from '../workspaces/workspace-store.js';
import type { SettingsStore } from '../settings/settings-store.js';

export function stateHandlers(deps: { workspaces: WorkspaceStore; settings: SettingsStore }) {
  return {
    getInitial: wrapHandler('state.getInitial', z.object({}), async () => ({
      workspaces: deps.workspaces.list(),
      workspaceOrder: deps.workspaces.order(),
      settings: deps.settings.get(),
    })),
  };
}
