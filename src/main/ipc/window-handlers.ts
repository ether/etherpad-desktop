import { wrapHandler } from './dispatcher.js';
import {
  setActiveWorkspacePayload,
  setPadViewsHiddenPayload,
  setRailCollapsedPayload,
} from '@shared/ipc/channels';
import { z } from 'zod';

export type WindowHandlerDeps = {
  setActiveWorkspaceForActiveWindow: (id: string | null) => void;
  reloadShellOfActiveWindow: () => void;
  setPadViewsHiddenForActiveWindow: (hidden: boolean) => void;
  setRailCollapsedForActiveWindow: (collapsed: boolean) => void;
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
    setPadViewsHidden: wrapHandler('window.setPadViewsHidden', setPadViewsHiddenPayload, async (input) => {
      deps.setPadViewsHiddenForActiveWindow(input.hidden);
      return { ok: true } as const;
    }),
    setRailCollapsed: wrapHandler('window.setRailCollapsed', setRailCollapsedPayload, async (input) => {
      deps.setRailCollapsedForActiveWindow(input.collapsed);
      return { ok: true } as const;
    }),
  };
}
