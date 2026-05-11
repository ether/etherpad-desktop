import { useShellStore, dialogActions } from './state/store.js';

/**
 * Expose internals on `window` so E2E tests can drive the shell from
 * outside React. Each runtime calls this conditionally — desktop's
 * `renderer/index.tsx` invokes it only when the preload reports
 * `e2eFlags.enabled === true`; mobile will do the equivalent when it
 * wires up native E2E. Shell itself does not read any runtime flag.
 */
export function attachE2EHelpers(target: Window = window): void {
  const win = target as unknown as {
    __test_useShellStore?: unknown;
    __test_dialogActions?: unknown;
  };
  win.__test_useShellStore = useShellStore;
  win.__test_dialogActions = {
    openHttpAuth: (requestId: string, url: string): void =>
      dialogActions.openDialog('httpAuth', { requestId, url }),
    openRemoveWorkspace: (name: string): void => {
      const ws = useShellStore.getState().workspaces.find((w) => w.name === name);
      if (ws) dialogActions.openDialog('removeWorkspace', { workspaceId: ws.id });
    },
  };
}
