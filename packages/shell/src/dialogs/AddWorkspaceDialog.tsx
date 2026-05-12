import React, { useState } from 'react';
import { ipc } from '../platform/ipc.js';
import { dialogActions, useShellStore } from '../state/store.js';
import { t } from '../i18n/index.js';
import { AppError } from '@shared/types/errors';
import { DialogShell } from '../components/DialogShell.js';

const PALETTE = ['#44b492', '#3366cc', '#16a34a', '#dc2626', '#9333ea', '#f59e0b', '#0ea5e9', '#ec4899'];

export function AddWorkspaceDialog({ dismissable }: { dismissable: boolean }): React.JSX.Element {
  const settingsUserName = useShellStore((s) => s.settings?.userName ?? '');
  const [name, setName] = useState(settingsUserName);
  const [serverUrl, setServerUrl] = useState('');
  const [color, setColor] = useState(PALETTE[0]!);
  const [embedded, setEmbedded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Embedded workspaces don't need a serverUrl — the local Etherpad assigns
  // its own. Disable the URL field and skip the Boolean(serverUrl) gate.
  const canSubmit = Boolean(name) && (embedded || Boolean(serverUrl));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      let ws;
      if (embedded) {
        // Embedded workspaces skip the URL probe; the local Etherpad
        // assigns its own URL once the server boots.
        ws = await ipc.workspace.add({ name, color, kind: 'embedded' });
      } else {
        // Auto-prefix `https://` when the user types a bare hostname.
        // The probe rejects URLs without a scheme as UrlValidationError,
        // and typing `https://` on every workspace add is friction —
        // especially on mobile.
        const normalisedUrl = /^[a-z]+:\/\//i.test(serverUrl.trim())
          ? serverUrl.trim()
          : `https://${serverUrl.trim()}`;
        ws = await ipc.workspace.add({ name, serverUrl: normalisedUrl, color });
      }
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
    <DialogShell
      labelledBy="add-ws-title"
      dismissOnEscape={dismissable}
      dismissOnOverlayClick={dismissable}
    >
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
      {!embedded && (
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
      <label className="dialog-field-inline">
        <input
          type="checkbox"
          checked={embedded}
          onChange={(e) => setEmbedded(e.target.checked)}
        />
        <span>
          {t.addWorkspace.embedded}
          <small style={{ display: 'block', color: 'var(--text-muted)', marginTop: 2 }}>
            {t.addWorkspace.embeddedHint}
          </small>
        </span>
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
        <button className="btn-primary" title={t.addWorkspace.submit} onClick={() => void submit()} disabled={busy || !canSubmit}>
          {busy ? t.addWorkspace.probing : t.addWorkspace.submit}
        </button>
        {dismissable && <button className="btn-secondary" title={t.addWorkspace.cancel} onClick={() => dialogActions.closeDialog()}>{t.addWorkspace.cancel}</button>}
      </div>
    </DialogShell>
  );
}
