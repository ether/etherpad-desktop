import React, { useState } from 'react';
import { ipc } from '../ipc/api.js';
import { dialogActions, useShellStore } from '../state/store.js';
import { t } from '../i18n/index.js';

const EMPTY_HISTORY: never[] = [];

export function OpenPadDialog(): React.JSX.Element {
  const wsId = useShellStore((s) => s.activeWorkspaceId);
  const history = useShellStore((s) => (wsId ? s.padHistory[wsId] ?? EMPTY_HISTORY : EMPTY_HISTORY));
  const [name, setName] = useState('');
  const [createMode, setCreateMode] = useState(false);

  const matches = name
    ? history.filter((e) => e.padName.toLowerCase().includes(name.toLowerCase())).slice(0, 8)
    : [];

  const submit = async (override?: string) => {
    const padName = override ?? name;
    if (!wsId || !padName) return;
    await ipc.tab.open({ workspaceId: wsId, padName, mode: createMode ? 'create' : 'open' });
    dialogActions.closeDialog();
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="open-pad-title" style={overlayStyle}>
      <div style={panelStyle}>
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
        <label className="dialog-field-inline">
          <input type="checkbox" checked={createMode} onChange={(e) => setCreateMode(e.target.checked)} />
          <span>{t.openPad.create}</span>
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn-primary" onClick={() => void submit()} disabled={!name}>
            {t.openPad.submit}
          </button>
          <button className="btn-secondary" onClick={() => dialogActions.closeDialog()}>{t.addWorkspace.cancel}</button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--modal-overlay-bg)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 100,
};
const panelStyle: React.CSSProperties = {
  background: 'var(--panel-bg)',
  color: 'var(--panel-fg)',
  padding: 24,
  borderRadius: 12,
  width: 420,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  boxShadow: 'var(--panel-shadow)',
  border: '1px solid var(--panel-border)',
};
