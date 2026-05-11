import React from 'react';
import { useShellStore, dialogActions } from '../state/store.js';
import { ipc } from '../platform/ipc.js';
import { t, fmt } from '../i18n/index.js';

export function WorkspaceRail(): React.JSX.Element {
  const order = useShellStore((s) => s.workspaceOrder);
  const workspaces = useShellStore((s) => s.workspaces);
  const active = useShellStore((s) => s.activeWorkspaceId);
  const collapsed = useShellStore((s) => s.railCollapsed);
  const byId = Object.fromEntries(workspaces.map((w) => [w.id, w]));

  const select = async (id: string) => {
    useShellStore.getState().setActiveWorkspaceId(id);
    await ipc.window.setActiveWorkspace(id);
  };

  return (
    <nav
      className={`workspace-rail${collapsed ? ' workspace-rail-collapsed' : ''}`}
      aria-label={t.rail.label}
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
                aria-label={fmt(t.rail.openWorkspace, { name: ws.name })}
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
      {!collapsed && (
        <div className="workspace-rail-bottom">
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
        </div>
      )}
    </nav>
  );
}
