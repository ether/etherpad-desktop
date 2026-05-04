import React, { useState } from 'react';
import { ipc } from '../ipc/api.js';
import { dialogActions, useShellStore } from '../state/store.js';
import { t } from '../i18n/index.js';

export function RemoveWorkspaceDialog(): JSX.Element | null {
  const workspaceId = useShellStore((s) => (s.dialogContext as { workspaceId?: string }).workspaceId);
  const ws = useShellStore((s) => s.workspaces.find((w) => w.id === workspaceId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!ws) return null;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await ipc.workspace.remove({ id: ws.id });
      const next = useShellStore.getState().workspaceOrder[0] ?? null;
      useShellStore.getState().setActiveWorkspaceId(next);
      if (next) await ipc.window.setActiveWorkspace(next);
      dialogActions.closeDialog();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="rm-ws-title" style={overlayStyle}>
      <div style={panelStyle}>
        <h2 id="rm-ws-title">{t.removeWorkspace.title}</h2>
        <p>
          <strong>{ws.name}</strong>
        </p>
        <p>{t.removeWorkspace.body}</p>
        {error && <p role="alert" style={{ color: 'var(--error)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary" onClick={() => void confirm()} disabled={busy}>
            {t.removeWorkspace.confirm}
          </button>
          <button className="btn-secondary" onClick={() => dialogActions.closeDialog()}>{t.removeWorkspace.cancel}</button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center', zIndex: 100 };
const panelStyle: React.CSSProperties = { background: '#fff', padding: 24, borderRadius: 12, width: 420, display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 10px 40px rgba(0,0,0,0.25)' };
