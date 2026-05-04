import React from 'react';
import { useEffect } from 'react';
import { ipc } from './ipc/api.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { useShellStore, dialogActions } from './state/store.js';

// M9 will replace these stubs with the real component files.
function AddWorkspaceDialog(_: { dismissable: boolean }): JSX.Element { return <div role="dialog" aria-label="add-workspace-stub" />; }
function OpenPadDialog(): JSX.Element { return <div role="dialog" aria-label="open-pad-stub" />; }
function SettingsDialog(): JSX.Element { return <div role="dialog" aria-label="settings-stub" />; }
function RemoveWorkspaceDialog(): JSX.Element { return <div role="dialog" aria-label="remove-workspace-stub" />; }
function HttpAuthDialog(): JSX.Element { return <div role="dialog" aria-label="http-auth-stub" />; }
function WorkspaceRail(): JSX.Element { return <nav aria-label="workspace-rail-stub" />; }
function PadSidebar(): JSX.Element { return <aside aria-label="pad-sidebar-stub" />; }
function TabStrip(): JSX.Element { return <div role="tablist" aria-label="tab-strip-stub" />; }
function EmptyState(): JSX.Element { return <div aria-label="empty-state-stub" />; }

export function App(): JSX.Element {
  const workspaces = useShellStore((s) => s.workspaces);
  const openDialog = useShellStore((s) => s.openDialog);
  const activeWorkspaceId = useShellStore((s) => s.activeWorkspaceId);
  const tabs = useShellStore((s) => s.tabs);

  useEffect(() => {
    void (async () => {
      const initial = await ipc.state.getInitial();
      useShellStore.getState().hydrate(initial);
      if (initial.workspaces.length === 0) {
        dialogActions.openDialog('addWorkspace');
      } else if (initial.workspaceOrder[0]) {
        useShellStore.getState().setActiveWorkspaceId(initial.workspaceOrder[0]);
        await ipc.window.setActiveWorkspace(initial.workspaceOrder[0]);
      }
    })();
  }, []);

  useEffect(() => {
    const offs = [
      window.etherpadDesktop.events.onWorkspacesChanged((p) => {
        const payload = p as { workspaces: typeof workspaces; order: string[] };
        useShellStore.setState({ workspaces: payload.workspaces, workspaceOrder: payload.order });
      }),
      window.etherpadDesktop.events.onTabsChanged((p) => {
        const payload = p as { tabs: typeof tabs };
        useShellStore.getState().replaceTabs(payload.tabs);
      }),
      window.etherpadDesktop.events.onTabState((p) => {
        const change = p as { tabId: string; state: string; errorMessage?: string; title?: string };
        useShellStore.setState((s) => ({
          tabs: s.tabs.map((t) =>
            t.tabId === change.tabId
              ? {
                  ...t,
                  state: change.state as (typeof t)['state'],
                  ...(change.errorMessage !== undefined ? { errorMessage: change.errorMessage } : {}),
                  ...(change.title !== undefined ? { title: change.title } : {}),
                }
              : t,
          ),
        }));
      }),
      window.etherpadDesktop.events.onPadHistoryChanged(async () => {
        const id = useShellStore.getState().activeWorkspaceId;
        if (id) {
          const entries = await ipc.padHistory.list(id);
          useShellStore.getState().setPadHistory(id, entries);
        }
      }),
      window.etherpadDesktop.events.onHttpLoginRequest((p) => {
        dialogActions.openDialog('httpAuth', p as Record<string, unknown>);
      }),
      window.etherpadDesktop.events.onMenuShellMessage((p) => {
        const k = (p as { kind: string }).kind;
        if (k === 'menu.newTab' || k === 'menu.openPad') dialogActions.openDialog('openPad');
        if (k === 'menu.settings') dialogActions.openDialog('settings');
      }),
    ];
    return () => offs.forEach((o) => o());
  }, []);

  const activeTabsForWs = activeWorkspaceId
    ? tabs.filter((t) => t.workspaceId === activeWorkspaceId)
    : [];

  return (
    <ErrorBoundary onReload={() => void ipc.window.reloadShell()}>
      <div className="shell-root">
        <div style={{ gridColumn: '1', gridRow: '1 / span 2' }}>
          <WorkspaceRail />
        </div>
        <div style={{ gridColumn: '2', gridRow: '1 / span 2' }}>
          <PadSidebar />
        </div>
        <div style={{ gridColumn: '3', gridRow: '1' }}>
          <TabStrip />
        </div>
        <div style={{ gridColumn: '3', gridRow: '2', position: 'relative' }}>
          {activeTabsForWs.length === 0 ? <EmptyState /> : null}
        </div>
      </div>
      {openDialog === 'addWorkspace' && <AddWorkspaceDialog dismissable={workspaces.length > 0} />}
      {openDialog === 'openPad' && <OpenPadDialog />}
      {openDialog === 'settings' && <SettingsDialog />}
      {openDialog === 'removeWorkspace' && <RemoveWorkspaceDialog />}
      {openDialog === 'httpAuth' && <HttpAuthDialog />}
    </ErrorBoundary>
  );
}
