import React, { useState } from 'react';
import { ipc } from '../ipc/api.js';
import { dialogActions, useShellStore } from '../state/store.js';
import { t } from '../i18n/index.js';

export function HttpAuthDialog(): React.JSX.Element {
  const ctx = useShellStore((s) => s.dialogContext as { requestId: string; url?: string; realm?: string });
  const [u, setU] = useState('');
  const [p, setP] = useState('');

  const submit = async (cancel: boolean) => {
    const requestId = ctx.requestId ?? '';
    await ipc.httpLogin.respond({
      requestId,
      cancel,
      ...(cancel ? {} : { username: u, password: p }),
    });
    dialogActions.closeDialog();
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="http-title" style={overlayStyle}>
      <div style={panelStyle}>
        <h2 id="http-title">{t.httpAuth.title}</h2>
        <p>{t.httpAuth.bodyPrefix}{ctx.url}</p>
        <label>{t.httpAuth.username}<input value={u} onChange={(e) => setU(e.target.value)} autoFocus /></label>
        <label>{t.httpAuth.password}<input type="password" value={p} onChange={(e) => setP(e.target.value)} /></label>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn-primary" onClick={() => void submit(false)} disabled={!u}>{t.httpAuth.submit}</button>
          <button className="btn-secondary" onClick={() => void submit(true)}>{t.httpAuth.cancel}</button>
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
