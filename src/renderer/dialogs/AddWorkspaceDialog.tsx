import React, { useState } from 'react';
import { ipc } from '../ipc/api.js';
import { dialogActions, useShellStore } from '../state/store.js';
import { t } from '../i18n/index.js';
import { AppError } from '@shared/types/errors';

const PALETTE = ['#44b492', '#3366cc', '#16a34a', '#dc2626', '#9333ea', '#f59e0b', '#0ea5e9', '#ec4899'];

export function AddWorkspaceDialog({ dismissable }: { dismissable: boolean }): React.JSX.Element {
  const settingsUserName = useShellStore((s) => s.settings?.userName ?? '');
  const [name, setName] = useState(settingsUserName);
  const [serverUrl, setServerUrl] = useState('');
  const [color, setColor] = useState(PALETTE[0]!);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [useEmbedded, setUseEmbedded] = useState(false);

  const canSubmit = Boolean(name) && (useEmbedded || Boolean(serverUrl));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const ws = useEmbedded
        ? await ipc.workspace.add({ name, color, kind: 'embedded' })
        : await ipc.workspace.add({ name, serverUrl, color });
      useShellStore.getState().setActiveWorkspaceId(ws.id);
      await ipc.window.setActiveWorkspace(ws.id);
      dialogActions.closeDialog();
    } catch (e) {
      if (e instanceof AppError) {
        if (e.kind === 'ServerUnreachableError') setError(t.addWorkspace.errorUnreachable);
        else if (e.kind === 'NotAnEtherpadServerError') setError(t.addWorkspace.errorNotEtherpad);
        else if (e.kind === 'UrlValidationError' || e.kind === 'InvalidPayloadError') setError(t.addWorkspace.errorUrl);
        else setError(useEmbedded ? t.addWorkspace.errorEmbeddedFailed : e.message);
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
        <label className="dialog-field">
          <span className="dialog-label">
            {t.addWorkspace.nameLabel}
            {settingsUserName && (
              <span style={{ marginLeft: 6, fontSize: '0.8em', color: 'var(--text-muted)' }}>
                {t.addWorkspace.nameFromSettings}
              </span>
            )}
          </span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
        </label>
        <label className="dialog-field-inline">
          <input
            type="checkbox"
            checked={useEmbedded}
            onChange={(e) => setUseEmbedded(e.target.checked)}
          />
          <span>{t.addWorkspace.embeddedToggle}</span>
        </label>
        {useEmbedded ? (
          <p style={{ margin: 0, fontSize: '0.875em', color: 'var(--panel-fg)', opacity: 0.75 }}>
            {t.addWorkspace.embeddedHint}
          </p>
        ) : (
          <label className="dialog-field">
            <span className="dialog-label">{t.addWorkspace.serverUrlLabel}</span>
            <input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://pads.example.com"
              required
            />
          </label>
        )}
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
          <button className="btn-primary" title={t.addWorkspace.submit} onClick={() => void submit()} disabled={busy || !canSubmit}>
            {busy ? (useEmbedded ? t.addWorkspace.embeddedStarting : t.addWorkspace.probing) : t.addWorkspace.submit}
          </button>
          {dismissable && <button className="btn-secondary" title={t.addWorkspace.cancel} onClick={() => dialogActions.closeDialog()}>{t.addWorkspace.cancel}</button>}
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
