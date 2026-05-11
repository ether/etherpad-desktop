import { wrapHandler } from './dispatcher.js';
import { padHistoryListPayload, padHistoryMutatePayload } from '@shared/ipc/channels';
import { z } from 'zod';
import type { PadHistoryStore } from '../pads/pad-history-store.js';

export function padHistoryHandlers(deps: { padHistory: PadHistoryStore; emit: () => void }) {
  return {
    list: wrapHandler('padHistory.list', padHistoryListPayload, async ({ workspaceId }) =>
      deps.padHistory.listForWorkspace(workspaceId),
    ),
    pin: wrapHandler('padHistory.pin', padHistoryMutatePayload, async ({ workspaceId, padName }) => {
      deps.padHistory.pin(workspaceId, padName);
      deps.emit();
      return { ok: true } as const;
    }),
    unpin: wrapHandler('padHistory.unpin', padHistoryMutatePayload, async ({ workspaceId, padName }) => {
      deps.padHistory.unpin(workspaceId, padName);
      deps.emit();
      return { ok: true } as const;
    }),
    clearRecent: wrapHandler('padHistory.clearRecent', padHistoryListPayload, async ({ workspaceId }) => {
      deps.padHistory.clearWorkspace(workspaceId);
      deps.emit();
      return { ok: true } as const;
    }),
    clearAll: wrapHandler('padHistory.clearAll', z.object({}), async () => {
      deps.padHistory.clearAll();
      deps.emit();
      return { ok: true } as const;
    }),
  };
}
