import { wrapHandler } from './dispatcher.js';
import { tabOpenPayload, tabIdPayload } from '@shared/ipc/channels';
import { WorkspaceNotFoundError } from '@shared/types/errors';
import type { WorkspaceStore } from '../workspaces/workspace-store.js';
import type { PadHistoryStore } from '../pads/pad-history-store.js';
import type { PadSyncService } from '../pads/pad-sync-service.js';
import type { OpenTab } from '@shared/types/tab';

export type TabHandlerDeps = {
  workspaces: WorkspaceStore;
  padHistory: PadHistoryStore;
  padSync: PadSyncService;
  openInActiveWindow: (input: { workspaceId: string; padName: string; src: string }) => Promise<OpenTab>;
  closeInAnyWindow: (tabId: string) => void;
  focusInAnyWindow: (tabId: string) => void;
  reloadInAnyWindow: (tabId: string) => void;
  emitTabsChanged: () => void;
  emitPadHistoryChanged: () => void;
  getLanguage: () => string;
  getUserName: () => string;
  indexPadContent?: (workspaceId: string, padName: string) => void;
};

export function tabHandlers(deps: TabHandlerDeps) {
  return {
    open: wrapHandler('tab.open', tabOpenPayload, async (input) => {
      const ws = deps.workspaces.byId(input.workspaceId);
      if (!ws) throw new WorkspaceNotFoundError(input.workspaceId);
      const src = deps.padSync.resolveSrc({
        kind: 'remote',
        serverUrl: ws.serverUrl,
        padName: input.padName,
        lang: deps.getLanguage(),
        userName: deps.getUserName(),
      });
      const tab = await deps.openInActiveWindow({
        workspaceId: input.workspaceId,
        padName: input.padName,
        src,
      });
      deps.padHistory.touch(input.workspaceId, input.padName);
      deps.indexPadContent?.(input.workspaceId, input.padName);
      deps.emitTabsChanged();
      deps.emitPadHistoryChanged();
      return tab;
    }),
    close: wrapHandler('tab.close', tabIdPayload, async (input) => {
      deps.closeInAnyWindow(input.tabId);
      deps.emitTabsChanged();
      return { ok: true } as const;
    }),
    focus: wrapHandler('tab.focus', tabIdPayload, async (input) => {
      deps.focusInAnyWindow(input.tabId);
      deps.emitTabsChanged();
      return { ok: true } as const;
    }),
    reload: wrapHandler('tab.reload', tabIdPayload, async (input) => {
      deps.reloadInAnyWindow(input.tabId);
      return { ok: true } as const;
    }),
  };
}
