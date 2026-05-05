import React from 'react';
import { useShellStore, dialogActions } from '../state/store.js';
import { ipc } from '../ipc/api.js';
import { t } from '../i18n/index.js';

export function WorkspaceRail(): React.JSX.Element {
  const order = useShellStore((s) => s.workspaceOrder);
  const workspaces = useShellStore((s) => s.workspaces);
  const active = useShellStore((s) => s.activeWorkspaceId);
  const collapsed = useShellStore((s) => s.railCollapsed);
  const toggleCollapsed = useShellStore((s) => s.toggleRailCollapsed);
  const byId = Object.fromEntries(workspaces.map((w) => [w.id, w]));

  const select = async (id: string) => {
    useShellStore.getState().setActiveWorkspaceId(id);
    await ipc.window.setActiveWorkspace(id);
  };

  return (
    <nav
      className={`workspace-rail${collapsed ? ' workspace-rail-collapsed' : ''}`}
      aria-label="Workspace rail"
    >
      {!collapsed && (
        <div className="workspace-rail-scroll">
          {order.map((id) => {
            const ws = byId[id];
            if (!ws) return null;
            return (
              <button
                key={id}
                data-ws-id={id}
                aria-label={`Open workspace ${ws.name}`}
                title={ws.name}
                onClick={() => void select(id)}
                className="workspace-rail-icon"
                style={{
                  background: ws.color,
                  boxShadow: active === id ? '0 0 0 2px var(--accent)' : 'none',
                }}
              >
                {ws.name.slice(0, 2).toUpperCase()}
              </button>
            );
          })}
          <button
            aria-label={t.rail.add}
            title={t.rail.add}
            onClick={() => dialogActions.openDialog('addWorkspace')}
            className="workspace-rail-add"
          >
            +
          </button>
        </div>
      )}
      <div className="workspace-rail-bottom">
        <button
          aria-label={collapsed ? t.rail.expand : t.rail.collapse}
          title={collapsed ? t.rail.expand : t.rail.collapse}
          onClick={toggleCollapsed}
          className="workspace-rail-cog"
        >
          {collapsed ? '›' : '‹'}
        </button>
        {!collapsed && (
          <>
            <button
              aria-label={t.rail.search}
              title={t.rail.search}
              onClick={() => dialogActions.openDialog('quickSwitcher')}
              className="workspace-rail-cog"
            >
              🔍
            </button>
            <button
              aria-label={t.rail.settings}
              title={t.rail.settings}
              onClick={() => dialogActions.openDialog('settings')}
              className="workspace-rail-cog"
            >
              ⚙
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
