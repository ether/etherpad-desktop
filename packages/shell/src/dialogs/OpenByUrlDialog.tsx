import React, { useState } from 'react';
import { ipc } from '../platform/ipc.js';
import { dialogActions, useShellStore } from '../state/store.js';
import { t, fmt } from '../i18n/index.js';
import { AppError } from '@shared/types/errors';
import { DialogShell } from '../components/DialogShell.js';
import { parsePadUrl } from '@shared/url';

const PALETTE = ['#44b492', '#3366cc', '#16a34a', '#dc2626', '#9333ea', '#f59e0b', '#0ea5e9', '#ec4899'];

/**
 * "Open Pad by URL" — paste any Etherpad pad URL (e.g. one a colleague
 * shared in chat) and the app does the right thing:
 *
 *   1. Parses the URL into (serverUrl, padName).
 *   2. If an Etherpad instance is already configured at that serverUrl,
 *      just opens the pad in it.
 *   3. Otherwise probes that the URL is actually Etherpad, adds the
 *      instance with the host as default name, then opens the pad.
 *
 * The flow is one-step from the user's perspective: paste, hit Enter.
 * No need to first add the instance, then open the pad.
 */
export function OpenByUrlDialog(): React.JSX.Element {
  const workspaces = useShellStore((s) => s.workspaces);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setStatus(null);
    const parsed = parsePadUrl(url);
    if (!parsed) {
      setError(t.openByUrl.errorParse);
      return;
    }
    setBusy(true);
    try {
      // 1. Already-configured instance? Just open the pad.
      const existing = workspaces.find((w) => w.serverUrl === parsed.serverUrl);
      if (existing) {
        setStatus(t.openByUrl.instanceExists);
        useShellStore.getState().setActiveWorkspaceId(existing.id);
        await ipc.window.setActiveWorkspace(existing.id);
        await ipc.tab.open({ workspaceId: existing.id, padName: parsed.padName, mode: 'open' });
        dialogActions.closeDialog();
        return;
      }
      // 2. New instance — derive a default name from the URL host and add.
      const host = new URL(parsed.serverUrl).host;
      setStatus(fmt(t.openByUrl.addingInstance, { host }));
      const colour = PALETTE[workspaces.length % PALETTE.length]!;
      const ws = await ipc.workspace.add({ name: host, serverUrl: parsed.serverUrl, color: colour });
      useShellStore.getState().setActiveWorkspaceId(ws.id);
      await ipc.window.setActiveWorkspace(ws.id);
      await ipc.tab.open({ workspaceId: ws.id, padName: parsed.padName, mode: 'open' });
      dialogActions.closeDialog();
    } catch (e) {
      if (e instanceof AppError) {
        if (e.kind === 'ServerUnreachableError') setError(t.openByUrl.errorUnreachable);
        else if (e.kind === 'NotAnEtherpadServerError') setError(t.openByUrl.errorNotEtherpad);
        else setError(e.message);
      } else {
        setError(String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogShell labelledBy="open-by-url-title">
      <h2 id="open-by-url-title">{t.openByUrl.title}</h2>
      <label className="dialog-field">
        <span className="dialog-label">{t.openByUrl.label}</span>
        <input
          type="url"
          autoFocus
          value={url}
          placeholder={t.openByUrl.placeholder}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
            }
          }}
        />
      </label>
      {status && !error && (
        <p style={{ margin: 0, fontSize: '0.875em', color: 'var(--text-muted)' }}>{status}</p>
      )}
      {error && (
        <p role="alert" style={{ color: 'var(--error)' }}>{error}</p>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn-primary" onClick={() => void submit()} disabled={busy || !url}>
          {t.openByUrl.submit}
        </button>
        <button className="btn-secondary" onClick={() => dialogActions.closeDialog()}>
          {t.openByUrl.cancel}
        </button>
      </div>
    </DialogShell>
  );
}
