import React, { useState } from 'react';
import { ipc } from '../ipc/api.js';
import { dialogActions, useShellStore } from '../state/store.js';
import { t } from '../i18n/index.js';
import { AppError } from '@shared/types/errors';

const PALETTE = ['#44b492', '#3366cc', '#16a34a', '#dc2626', '#9333ea', '#f59e0b', '#0ea5e9', '#ec4899'];

export function AddWorkspaceDialog({ dismissable }: { dismissable: boolean }): JSX.Element {
  const [name, setName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [color, setColor] = useState(PALETTE[0]!);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const ws = await ipc.workspace.add({ name, serverUrl, color });
      useShellStore.getState().setActiveWorkspaceId(ws.id);
      await ipc.window.setActiveWorkspace(ws.id);
      dialogActions.closeDialog();
    } catch (e) {
      if (e instanceof AppError) {
        if (e.kind === 'ServerUnreachableError') setError(t.addWorkspace.errorUnreachable);
        else if (e.kind === 'NotAnEtherpadServerError') setError(t.addWorkspace.errorNotEtherpad);
        else if (e.kind === 'UrlValidationError' || e.kind === 'InvalidPayloadError') setError(t.addWorkspace.errorUrl);
        else setError(e.message);
      } else {
        setError(String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="add-ws-title" style={overlayStyle}>
      <div style={panelStyle}>
        <h2 id="add-ws-title">{t.addWorkspace.title}</h2>
        <label>
          {t.addWorkspace.nameLabel}
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
        </label>
        <label>
          {t.addWorkspace.serverUrlLabel}
          <input
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="https://pads.example.com"
            required
          />
        </label>
        <fieldset style={{ border: 'none', padding: 0 }}>
          <legend>{t.addWorkspace.colorLabel}</legend>
          <div style={{ display: 'flex', gap: 6 }}>
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                aria-pressed={c === color}
                onClick={() => setColor(c)}
                style={{ width: 24, height: 24, borderRadius: 12, border: c === color ? '2px solid var(--color-secondary-dark)' : '1px solid var(--tab-border)', background: c }}
              />
            ))}
          </div>
        </fieldset>
        {error && <p role="alert" style={{ color: 'var(--error)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn-primary" onClick={() => void submit()} disabled={busy || !name || !serverUrl}>
            {busy ? t.addWorkspace.probing : t.addWorkspace.submit}
          </button>
          {dismissable && <button className="btn-secondary" onClick={() => dialogActions.closeDialog()}>{t.addWorkspace.cancel}</button>}
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 100,
};
const panelStyle: React.CSSProperties = {
  background: '#fff',
  padding: 24,
  borderRadius: 12,
  width: 420,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
};
