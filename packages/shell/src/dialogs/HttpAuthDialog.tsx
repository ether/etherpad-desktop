import React, { useState } from 'react';
import { ipc } from '../platform/ipc.js';
import { dialogActions, useShellStore } from '../state/store.js';
import { t } from '../i18n/index.js';
import { DialogShell } from '../components/DialogShell.js';

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
    <DialogShell labelledBy="http-title">
      <h2 id="http-title">{t.httpAuth.title}</h2>
      <p>{t.httpAuth.bodyPrefix}{ctx.url}</p>
      <label>{t.httpAuth.username}<input value={u} onChange={(e) => setU(e.target.value)} autoFocus /></label>
      <label>{t.httpAuth.password}<input type="password" value={p} onChange={(e) => setP(e.target.value)} /></label>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn-primary" title={t.httpAuth.submit} onClick={() => void submit(false)} disabled={!u}>{t.httpAuth.submit}</button>
        <button className="btn-secondary" title={t.httpAuth.cancel} onClick={() => void submit(true)}>{t.httpAuth.cancel}</button>
      </div>
    </DialogShell>
  );
}
