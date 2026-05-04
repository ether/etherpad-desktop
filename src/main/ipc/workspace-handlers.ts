import { wrapHandler } from './dispatcher.js';
import type { WorkspaceStore } from '../workspaces/workspace-store.js';
import type { PadHistoryStore } from '../pads/pad-history-store.js';
import {
  workspaceAddPayload,
  workspaceUpdatePayload,
  workspaceRemovePayload,
  workspaceReorderPayload,
} from '@shared/ipc/channels';
import { z } from 'zod';
import {
  NotAnEtherpadServerError,
  ServerUnreachableError,
  WorkspaceNotFoundError,
} from '@shared/types/errors';

export type WorkspaceHandlerDeps = {
  workspaces: WorkspaceStore;
  padHistory: PadHistoryStore;
  closeAllTabsForWorkspace: (workspaceId: string) => void;
  clearWorkspaceStorage: (workspaceId: string) => Promise<void>;
  probeIsEtherpad: (serverUrl: string) => Promise<boolean>;
  emitWorkspacesChanged: () => void;
  emitPadHistoryChanged: () => void;
};

export function workspaceHandlers(deps: WorkspaceHandlerDeps) {
  return {
    list: wrapHandler('workspace.list', z.object({}), async () => ({
      workspaces: deps.workspaces.list(),
      order: deps.workspaces.order(),
    })),
    add: wrapHandler('workspace.add', workspaceAddPayload, async (input) => {
      let ok: boolean;
      try {
        ok = await deps.probeIsEtherpad(input.serverUrl);
      } catch {
        throw new ServerUnreachableError(input.serverUrl);
      }
      if (!ok) throw new NotAnEtherpadServerError(input.serverUrl);
      const ws = deps.workspaces.add(input);
      deps.emitWorkspacesChanged();
      return ws;
    }),
    update: wrapHandler('workspace.update', workspaceUpdatePayload, async (input) => {
      const ws = deps.workspaces.update({
        id: input.id,
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.serverUrl !== undefined ? { serverUrl: input.serverUrl } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
      });
      deps.emitWorkspacesChanged();
      return ws;
    }),
    remove: wrapHandler('workspace.remove', workspaceRemovePayload, async (input) => {
      if (!deps.workspaces.byId(input.id)) throw new WorkspaceNotFoundError(input.id);
      const wsSnap = deps.workspaces.snapshot();
      const histSnap = deps.padHistory.snapshot();
      try {
        deps.closeAllTabsForWorkspace(input.id);
        deps.padHistory.clearWorkspace(input.id);
        deps.workspaces.remove(input.id);
      } catch (e) {
        deps.workspaces.restore(wsSnap);
        deps.padHistory.restore(histSnap);
        throw e;
      }
      try {
        await deps.clearWorkspaceStorage(input.id);
      } catch {
        // Partition wipe failed — log handled by caller; workspace is already gone from view.
      }
      deps.emitWorkspacesChanged();
      deps.emitPadHistoryChanged();
      return { ok: true } as const;
    }),
    reorder: wrapHandler('workspace.reorder', workspaceReorderPayload, async (input) => {
      deps.workspaces.reorder(input.order);
      deps.emitWorkspacesChanged();
      return deps.workspaces.order();
    }),
  };
}
