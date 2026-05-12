import React, { useState } from 'react';
import { ipc } from '../platform/ipc.js';
import { dialogActions, useShellStore } from '../state/store.js';
import { t } from '../i18n/index.js';
import { DialogShell } from '../components/DialogShell.js';

export function ClearAllHistoryDialog(): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workspaces = useShellStore((s) => s.workspaces);

  const confirm = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await ipc.padHistory.clearAll();
      // Re-pull empty history for every workspace so the sidebar updates
      // immediately — the desktop main process broadcasts a per-workspace
      // change event after clearAll, but mobile platforms emit a single
      // generic event so the shell needs to refresh each list itself.
      for (const ws of workspaces) {
        useShellStore.getState().setPadHistory(ws.id, []);
      }
      dialogActions.closeDialog();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogShell labelledBy="clear-all-history-title">
      <h2 id="clear-all-history-title">{t.clearAllHistory.title}</h2>
      <p>{t.clearAllHistory.body}</p>
      {error && <p role="alert" style={{ color: 'var(--error)' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn-primary"
          title={t.clearAllHistory.confirm}
          onClick={() => void confirm()}
          disabled={busy}
        >
          {t.clearAllHistory.confirm}
        </button>
        <button
          className="btn-secondary"
          title={t.clearAllHistory.cancel}
          onClick={() => dialogActions.closeDialog()}
        >
          {t.clearAllHistory.cancel}
        </button>
      </div>
    </DialogShell>
  );
}
