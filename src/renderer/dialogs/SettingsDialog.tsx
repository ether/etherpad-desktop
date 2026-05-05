import React, { useEffect, useState } from 'react';
import { ipc } from '../ipc/api.js';
import { dialogActions, useShellStore } from '../state/store.js';
import { t } from '../i18n/index.js';
import type { Settings } from '@shared/types/settings';
import { ETHERPAD_LOCALES, localeDisplayName } from '@shared/locales/etherpad-locales';

export function SettingsDialog(): React.JSX.Element | null {
  const settings = useShellStore((s) => s.settings);
  const workspaces = useShellStore((s) => s.workspaces);
  const [draft, setDraft] = useState<Settings | null>(settings);
  useEffect(() => { setDraft(settings); }, [settings]);
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
        <label className="settings-row">
          <span className="settings-label">{t.settings.zoom}</span>
          <input
            type="number"
            min={0.5}
            max={3}
            step={0.1}
            value={draft.defaultZoom}
            onChange={(e) => setDraft({ ...draft, defaultZoom: parseFloat(e.target.value) })}
          />
        </label>
        <label className="settings-row">
          <span className="settings-label">{t.settings.accent}</span>
          <input
            type="color"
            value={draft.accentColor}
            onChange={(e) => setDraft({ ...draft, accentColor: e.target.value })}
          />
        </label>
        <label className="settings-row">
          <span className="settings-label">{t.settings.language}</span>
          <select
            value={draft.language}
            onChange={(e) => setDraft({ ...draft, language: e.target.value })}
          >
            {ETHERPAD_LOCALES.map((code) => (
              <option key={code} value={code}>
                {localeDisplayName(code)} ({code})
              </option>
            ))}
          </select>
        </label>
        <label className="settings-row">
          <span className="settings-label">{t.settings.theme}</span>
          <select
            value={draft.themePreference}
            onChange={(e) => setDraft({ ...draft, themePreference: e.target.value as 'light' | 'dark' | 'auto' })}
          >
            <option value="auto">{t.settings.themeAuto}</option>
            <option value="light">{t.settings.themeLight}</option>
            <option value="dark">{t.settings.themeDark}</option>
          </select>
        </label>
        <label className="settings-row" style={{ gridTemplateColumns: 'auto 1fr' }}>
          <input
            type="checkbox"
            checked={draft.rememberOpenTabsOnQuit}
            onChange={(e) => setDraft({ ...draft, rememberOpenTabsOnQuit: e.target.checked })}
          />
          <span className="settings-label" style={{ color: 'var(--text)' }}>{t.settings.rememberTabs}</span>
        </label>
        <label className="settings-row" style={{ gridTemplateColumns: 'auto 1fr' }}>
          <input
            type="checkbox"
            checked={draft.minimizeToTray}
            onChange={(e) => setDraft({ ...draft, minimizeToTray: e.target.checked })}
          />
          <span className="settings-label" style={{ color: 'var(--text)' }}>{t.settings.minimizeToTray}</span>
        </label>
        <button onClick={() => void ipc.padHistory.clearAll()}>{t.settings.clearAllHistory}</button>
        <section>
          <h3>Workspaces</h3>
          {workspaces.map((ws) => (
            <div key={ws.id} className="settings-row" style={{ gridTemplateColumns: '1fr auto' }}>
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
