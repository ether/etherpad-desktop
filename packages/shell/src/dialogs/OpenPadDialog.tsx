import React, { useState } from 'react';
import { ipc } from '../platform/ipc.js';
import { dialogActions, useShellStore } from '../state/store.js';
import { t } from '../i18n/index.js';
import { DialogShell } from '../components/DialogShell.js';

const EMPTY_HISTORY: never[] = [];

export function OpenPadDialog(): React.JSX.Element {
  const wsId = useShellStore((s) => s.activeWorkspaceId);
  const history = useShellStore((s) => (wsId ? s.padHistory[wsId] ?? EMPTY_HISTORY : EMPTY_HISTORY));
  const [name, setName] = useState('');

  const matches = name
    ? history.filter((e) => e.padName.toLowerCase().includes(name.toLowerCase())).slice(0, 8)
    : [];

  // Etherpad's `/p/<name>` URL is open-or-create: visiting it loads the
  // pad if it exists or creates it on demand. There's no separate
  // "create" path in the server, and tab-handlers/tab-store never read
  // `mode`. The previous "Create new" checkbox was cosmetic; removing
  // it. `mode` stays on the IPC payload (schema-level default 'open')
  // so external callers don't break.
  const submit = async (override?: string) => {
    const padName = override ?? name;
    if (!wsId || !padName) return;
    await ipc.tab.open({ workspaceId: wsId, padName, mode: 'open' });
    dialogActions.closeDialog();
  };

  return (
    <DialogShell labelledBy="open-pad-title">
      <h2 id="open-pad-title">{t.openPad.title}</h2>
      <label className="dialog-field">
        <span className="dialog-label">{t.openPad.label}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      {matches.length > 0 && (
        <ul role="listbox" style={{ listStyle: 'none', padding: 0, margin: 0, border: '1px solid var(--panel-border)' }}>
          {matches.map((m) => (
            <li key={m.padName} role="option" aria-selected={false}>
              <button type="button" onClick={() => void submit(m.padName)} style={{ width: '100%', textAlign: 'left', padding: 4 }}>
                {m.padName}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn-primary" title={t.openPad.submit} onClick={() => void submit()} disabled={!name}>
          {t.openPad.submit}
        </button>
        <button className="btn-secondary" title={t.addWorkspace.cancel} onClick={() => dialogActions.closeDialog()}>{t.addWorkspace.cancel}</button>
      </div>
    </DialogShell>
  );
}
