import React, { useEffect, useState } from 'react';
import { ipc } from '../ipc/api.js';
import { dialogActions, useShellStore } from '../state/store.js';
import { t } from '../i18n/index.js';
import type { Settings } from '@shared/types/settings';

export function SettingsDialog(): JSX.Element | null {
  const settings = useShellStore((s) => s.settings);
  const workspaces = useShellStore((s) => s.workspaces);
  const [draft, setDraft] = useState<Settings | null>(settings);
  useEffect(() => setDraft(settings), [settings]);
  if (!draft) return null;

  const save = async () => {
    const { schemaVersion: _schemaVersion, ...patch } = draft;
    await ipc.settings.update(patch);
    dialogActions.closeDialog();
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="settings-title" style={overlayStyle}>
      <div style={panelStyle}>
        <h2 id="settings-title">{t.settings.title}</h2>
        <label>
          {t.settings.zoom}
          <input
            type="number"
            min={0.5}
            max={3}
            step={0.1}
            value={draft.defaultZoom}
            onChange={(e) => setDraft({ ...draft, defaultZoom: parseFloat(e.target.value) })}
          />
        </label>
        <label>
          {t.settings.accent}
          <input
            type="color"
            value={draft.accentColor}
            onChange={(e) => setDraft({ ...draft, accentColor: e.target.value })}
          />
        </label>
        <label>
          {t.settings.language}
          <input
            value={draft.language}
            onChange={(e) => setDraft({ ...draft, language: e.target.value })}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={draft.rememberOpenTabsOnQuit}
            onChange={(e) => setDraft({ ...draft, rememberOpenTabsOnQuit: e.target.checked })}
          />
          {t.settings.rememberTabs}
        </label>
        <button onClick={() => void ipc.padHistory.clearAll()}>{t.settings.clearAllHistory}</button>
        <section>
          <h3>Workspaces</h3>
          {workspaces.map((ws) => (
            <div key={ws.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{ws.name}</span>
              <button onClick={() => dialogActions.openDialog('removeWorkspace', { workspaceId: ws.id })}>
                Remove
              </button>
            </div>
          ))}
        </section>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn-primary" onClick={() => void save()}>{t.settings.save}</button>
          <button className="btn-secondary" onClick={() => dialogActions.closeDialog()}>{t.settings.cancel}</button>
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
