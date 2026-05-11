import React, { useState } from 'react';
import { ipc } from '../platform/ipc.js';
import { dialogActions, useShellStore } from '../state/store.js';
import { t } from '../i18n/index.js';
import { DialogShell } from '../components/DialogShell.js';

export function RemoveWorkspaceDialog(): React.JSX.Element | null {
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
    <DialogShell labelledBy="rm-ws-title">
      <h2 id="rm-ws-title">{t.removeWorkspace.title}</h2>
      <p>
        <strong>{ws.name}</strong>
      </p>
      <p>{t.removeWorkspace.body}</p>
      {error && <p role="alert" style={{ color: 'var(--error)' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-primary" title={t.removeWorkspace.confirm} onClick={() => void confirm()} disabled={busy}>
          {t.removeWorkspace.confirm}
        </button>
        <button className="btn-secondary" title={t.removeWorkspace.cancel} onClick={() => dialogActions.closeDialog()}>{t.removeWorkspace.cancel}</button>
      </div>
    </DialogShell>
  );
}
