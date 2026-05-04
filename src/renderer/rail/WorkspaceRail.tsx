import React from 'react';
import { useShellStore, dialogActions } from '../state/store.js';
import { ipc } from '../ipc/api.js';
import { t } from '../i18n/index.js';

export function WorkspaceRail(): JSX.Element {
  const order = useShellStore((s) => s.workspaceOrder);
  const workspaces = useShellStore((s) => s.workspaces);
  const active = useShellStore((s) => s.activeWorkspaceId);
  const byId = Object.fromEntries(workspaces.map((w) => [w.id, w]));

  const select = async (id: string) => {
    useShellStore.getState().setActiveWorkspaceId(id);
    await ipc.window.setActiveWorkspace(id);
  };

  return (
    <nav
      aria-label="Workspace rail"
      style={{ background: 'var(--rail-bg)', height: '100%', padding: '8px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
    >
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
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              border: '1px solid transparent',
              boxShadow: active === id ? '0 0 0 2px var(--accent)' : 'none',
              background: ws.color,
              color: '#fff',
              fontWeight: 600,
            }}
          >
            {ws.name.slice(0, 2).toUpperCase()}
          </button>
        );
      })}
      <button
        aria-label={t.rail.add}
        onClick={() => dialogActions.openDialog('addWorkspace')}
        style={{ width: 44, height: 44, borderRadius: 12, border: '1px dashed var(--text-muted)', background: 'transparent', color: 'var(--rail-fg)', opacity: 0.6 }}
      >
        +
      </button>
      <div style={{ flex: 1 }} />
      <button
        aria-label={t.rail.settings}
        onClick={() => dialogActions.openDialog('settings')}
        style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: 'transparent', color: 'var(--rail-fg)', opacity: 0.6 }}
      >
        ⚙
      </button>
    </nav>
  );
}
