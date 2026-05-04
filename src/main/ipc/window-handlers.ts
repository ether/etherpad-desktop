import { wrapHandler } from './dispatcher.js';
import { setActiveWorkspacePayload } from '@shared/ipc/channels';
import { z } from 'zod';

export type WindowHandlerDeps = {
  setActiveWorkspaceForActiveWindow: (id: string | null) => void;
  reloadShellOfActiveWindow: () => void;
  emitTabsChanged: () => void;
};

export function windowHandlers(deps: WindowHandlerDeps) {
  return {
    setActiveWorkspace: wrapHandler('window.setActiveWorkspace', setActiveWorkspacePayload, async (input) => {
      deps.setActiveWorkspaceForActiveWindow(input.workspaceId);
      deps.emitTabsChanged();
      return { ok: true } as const;
    }),
    reloadShell: wrapHandler('window.reloadShell', z.object({}), async () => {
      deps.reloadShellOfActiveWindow();
      return { ok: true } as const;
    }),
  };
}
