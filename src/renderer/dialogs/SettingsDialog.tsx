import React, { useEffect, useState } from 'react';
import { ipc } from '../ipc/api.js';
import { dialogActions, useShellStore } from '../state/store.js';
import { t } from '../i18n/index.js';
import type { Settings } from '@shared/types/settings';
import { ETHERPAD_LOCALES, localeDisplayName } from '@shared/locales/etherpad-locales';
import { DialogShell } from '../components/DialogShell.js';

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
    <DialogShell labelledBy="settings-title">
      <h2 id="settings-title">{t.settings.title}</h2>
      <label className="settings-row">
        <span className="settings-label">{t.settings.userName}</span>
        <input
          type="text"
          value={draft.userName}
          onChange={(e) => setDraft({ ...draft, userName: e.target.value })}
          placeholder={t.settings.userNamePlaceholder}
        />
      </label>
      <p className="settings-hint">{t.settings.userNameHint}</p>
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
          <div
            key={ws.id}
            className="workspace-edit-row"
          >
            <span
              className="workspace-edit-swatch"
              style={{ background: ws.color }}
              aria-hidden="true"
            />
            <input
              className="workspace-edit-name"
              type="text"
              value={ws.name}
              aria-label={t.workspaceRow.nameLabel}
              onChange={(e) => {
                void ipc.workspace.update({ id: ws.id, name: e.target.value });
              }}
            />
            <input
              className="workspace-edit-color"
              type="color"
              value={ws.color}
              aria-label={t.workspaceRow.colorLabel}
              title={t.workspaceRow.colorLabel}
              onChange={(e) => {
                void ipc.workspace.update({ id: ws.id, color: e.target.value });
              }}
            />
            <button
              className="btn-secondary"
              onClick={() => dialogActions.openDialog('removeWorkspace', { workspaceId: ws.id })}
            >
              {t.workspaceRow.remove}
            </button>
          </div>
        ))}
      </section>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn-primary" title={t.settings.save} onClick={() => void save()}>{t.settings.save}</button>
        <button className="btn-secondary" title={t.settings.cancel} onClick={() => dialogActions.closeDialog()}>{t.settings.cancel}</button>
      </div>
    </DialogShell>
  );
}
