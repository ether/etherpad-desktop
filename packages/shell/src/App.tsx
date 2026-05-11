import React from 'react';
import { useEffect } from 'react';
import type { Settings } from '@shared/types/settings';
import { ipc } from './platform/ipc.js';
import { applySettings } from './theme.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { useShellStore, dialogActions } from './state/store.js';
import { AddWorkspaceDialog } from './dialogs/AddWorkspaceDialog.js';
import { OpenPadDialog } from './dialogs/OpenPadDialog.js';
import { OpenByUrlDialog } from './dialogs/OpenByUrlDialog.js';
import { SettingsDialog } from './dialogs/SettingsDialog.js';
import { RemoveWorkspaceDialog } from './dialogs/RemoveWorkspaceDialog.js';
import { HttpAuthDialog } from './dialogs/HttpAuthDialog.js';
import { AboutDialog } from './dialogs/AboutDialog.js';
import { QuickSwitcherDialog } from './dialogs/QuickSwitcherDialog.js';
import { WorkspaceRail } from './rail/WorkspaceRail.js';
import { PadSidebar } from './sidebar/PadSidebar.js';
import { TabStrip } from './tabs/TabStrip.js';
import { EmptyState } from './components/EmptyState.js';
import { TabErrorOverlay } from './components/TabErrorOverlay.js';
import { UpdaterBanner } from './components/UpdaterBanner.js';
import { t } from './i18n/index.js';
import type { UpdaterState } from '@shared/types/updater';

/**
 * Resolve a "1".."9" digit to a pad of the active workspace and focus it.
 * Returns true if a focus call was issued (caller may want to preventDefault),
 * false if there was no eligible pad.
 *
 * Shared by both the shell's keydown listener and the onPadFastSwitch IPC
 * event so the two paths produce identical behaviour.
 */
function applyFastSwitch(key: string): boolean {
  const state = useShellStore.getState();
  const wsId = state.activeWorkspaceId;
  if (!wsId) return false;
  const padsForWs = state.tabs.filter((t) => t.workspaceId === wsId);
  if (padsForWs.length === 0) return false;
  const n = Number(key);
  const target = n === 9 ? padsForWs[padsForWs.length - 1] : padsForWs[n - 1];
  if (!target) return false;
  void ipc.tab.focus({ tabId: target.tabId });
  return true;
}

export function App(): React.JSX.Element {
  const workspaces = useShellStore((s) => s.workspaces);
  const openDialog = useShellStore((s) => s.openDialog);
  const activeWorkspaceId = useShellStore((s) => s.activeWorkspaceId);
  const tabs = useShellStore((s) => s.tabs);
  const railCollapsed = useShellStore((s) => s.railCollapsed);

  useEffect(() => {
    void (async () => {
      const initial = await ipc.state.getInitial();
      useShellStore.getState().hydrate(initial);
      const { setLanguage } = await import('./i18n/index.js');
      setLanguage(initial.settings.language);
      applySettings(initial.settings);
      if (initial.workspaces.length === 0) {
        dialogActions.openDialog('addWorkspace');
      } else if (initial.workspaceOrder[0]) {
        useShellStore.getState().setActiveWorkspaceId(initial.workspaceOrder[0]);
        await ipc.window.setActiveWorkspace(initial.workspaceOrder[0]);
      }
      // Hydrate updater state from main process on startup.
      const updaterStateRaw = await ipc.updater.getState() as UpdaterState;
      useShellStore.setState({ updaterState: updaterStateRaw });
    })();
  }, []);

  useEffect(() => {
    const offs = [
      ipc.events.onWorkspacesChanged((p) => {
        const payload = p as { workspaces: typeof workspaces; order: string[] };
        useShellStore.setState({ workspaces: payload.workspaces, workspaceOrder: payload.order });
      }),
      ipc.events.onTabsChanged((p) => {
        const payload = p as { tabs: typeof tabs; activeTabId?: string | null };
        useShellStore.getState().replaceTabs(payload.tabs);
        if (payload.activeTabId !== undefined) {
          useShellStore.getState().setActiveTabId(payload.activeTabId ?? null);
        }
      }),
      ipc.events.onTabState((p) => {
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
      ipc.events.onPadHistoryChanged(async () => {
        const id = useShellStore.getState().activeWorkspaceId;
        if (id) {
          const entries = await ipc.padHistory.list(id);
          useShellStore.getState().setPadHistory(id, entries);
        }
      }),
      ipc.events.onSettingsChanged((p) => {
        const newSettings = p as Settings;
        useShellStore.setState({ settings: newSettings });
        // Apply renderer-side i18n change immediately
        void import('./i18n/index.js').then(({ setLanguage }) => setLanguage(newSettings.language));
        applySettings(newSettings);
      }),
      ipc.events.onHttpLoginRequest((p) => {
        dialogActions.openDialog('httpAuth', p as Record<string, unknown>);
      }),
      ipc.events.onUpdaterState((p) => {
        useShellStore.setState({ updaterState: p as UpdaterState });
      }),
      ipc.events.onMenuShellMessage((p) => {
        const k = (p as { kind: string }).kind;
        if (k === 'menu.newWorkspace') dialogActions.openDialog('addWorkspace');
        if (k === 'menu.newTab' || k === 'menu.openPad') dialogActions.openDialog('openPad');
        if (k === 'menu.openByUrl') dialogActions.openDialog('openByUrl');
        if (k === 'menu.settings') dialogActions.openDialog('settings');
        if (k === 'menu.about') dialogActions.openDialog('about');
        if (k === 'menu.quickSwitcher') dialogActions.openDialog('quickSwitcher');
        if (k === 'menu.reload') {
          const { activeTabId: activeId } = useShellStore.getState();
          if (activeId) void ipc.tab.reload({ tabId: activeId });
        }
        if (k === 'menu.hardReload') {
          const { activeTabId: activeId } = useShellStore.getState();
          if (activeId) void ipc.tab.hardReload({ tabId: activeId });
        }
        if (k === 'menu.closeTab') {
          const { activeTabId: activeId } = useShellStore.getState();
          if (activeId) void ipc.tab.close({ tabId: activeId });
        }
      }),
      // Forwarded from a focused pad view via main-process before-input-event.
      // Runs the same fast-switch logic as the shell-level keydown listener.
      ipc.events.onPadFastSwitch(({ key }) => {
        if (!/^[1-9]$/.test(key)) return;
        applyFastSwitch(key);
      }),
    ];
    return () => offs.forEach((o) => o());
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inEditable = !!(target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ));

      // Modifier+1..9 — fast switch to the Nth pad of the active workspace.
      // Accepts Ctrl OR Cmd (browser convention) AND Alt (user-requested,
      // matches some Linux DE conventions). 9 jumps to the LAST pad. Skipped
      // when an input is focused so users can still type "1" in fields.
      // Mirrors the onPadFastSwitch path so a key from a focused pad view
      // (forwarded by main) runs the exact same logic as a key in the shell.
      const fastSwitchModifier = e.ctrlKey || e.metaKey || e.altKey;
      if (fastSwitchModifier && !e.shiftKey && /^[1-9]$/.test(e.key)) {
        if (inEditable) return;
        if (applyFastSwitch(e.key)) {
          e.preventDefault();
        }
        return;
      }

      // Ctrl/Cmd + K or F — open the quick switcher.
      const isK = e.key === 'k' || e.key === 'K';
      const isF = e.key === 'f' || e.key === 'F';
      if (!isK && !isF) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      if (inEditable) {
        // If the quick switcher itself is open, that's fine — the dialog will see Esc.
        if (useShellStore.getState().openDialog !== 'quickSwitcher') return;
      }
      e.preventDefault();
      dialogActions.openDialog('quickSwitcher');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    void ipc.window.setPadViewsHidden(openDialog !== null);
  }, [openDialog]);

  // Tell the main process when the rail collapses so it can re-position
  // pad WebContentsViews to fill the freed space. Without this, the views
  // stay anchored at x=304 and the user sees a black void where the rail
  // and sidebar used to be.
  useEffect(() => {
    void ipc.window.setRailCollapsed(railCollapsed);
  }, [railCollapsed]);

  const activeTabsForWs = activeWorkspaceId
    ? tabs.filter((t) => t.workspaceId === activeWorkspaceId)
    : [];

  const toggleRailCollapsed = useShellStore((s) => s.toggleRailCollapsed);

  return (
    <ErrorBoundary onReload={() => void ipc.window.reloadShell()}>
      <div className={`shell-root-wrapper${railCollapsed ? ' rail-collapsed' : ''}`}>
        <UpdaterBanner />
        <div className="shell-root">
          <div className="rail-cell" style={{ gridColumn: '1', gridRow: '1 / span 2' }}>
            <WorkspaceRail />
          </div>
          <div className="sidebar-cell" style={{ gridColumn: '2', gridRow: '1 / span 2' }}>
            <PadSidebar />
          </div>
          <div style={{ gridColumn: '3', gridRow: '1' }}>
            <TabStrip />
          </div>
          <div style={{ gridColumn: '3', gridRow: '2', position: 'relative' }}>
            {activeTabsForWs.length === 0 ? <EmptyState /> : null}
            <TabErrorOverlay />
          </div>
        </div>
        {/* Vertically-centred collapse/expand handle. When expanded it sits
            on the right edge of the pad sidebar; when collapsed it sits on
            the left edge of the (now full-width) pad area. CSS resolves the
            position from the --rail-width / --sidebar-width vars below. */}
        <button
          type="button"
          className="shell-collapse-handle"
          aria-label={railCollapsed ? t.rail.expand : t.rail.collapse}
          title={railCollapsed ? t.rail.expand : t.rail.collapse}
          onClick={toggleRailCollapsed}
        >
          {railCollapsed ? '›' : '‹'}
        </button>
      </div>
      {openDialog === 'addWorkspace' && <AddWorkspaceDialog dismissable={workspaces.length > 0} />}
      {openDialog === 'openPad' && <OpenPadDialog />}
      {openDialog === 'openByUrl' && <OpenByUrlDialog />}
      {openDialog === 'settings' && <SettingsDialog />}
      {openDialog === 'removeWorkspace' && <RemoveWorkspaceDialog />}
      {openDialog === 'httpAuth' && <HttpAuthDialog />}
      {openDialog === 'about' && <AboutDialog />}
      {openDialog === 'quickSwitcher' && <QuickSwitcherDialog />}
    </ErrorBoundary>
  );
}
