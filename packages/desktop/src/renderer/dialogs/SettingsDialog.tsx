import React, { useEffect, useState } from 'react';
import { ipc } from '../ipc/api.js';
import { dialogActions, useShellStore } from '../state/store.js';
import { t } from '../i18n/index.js';
import type { Settings } from '@shared/types/settings';
import type { Workspace } from '@shared/types/workspace';
import { ETHERPAD_LOCALES, localeDisplayName } from '@shared/locales/etherpad-locales';
import { DialogShell } from '../components/DialogShell.js';

/**
 * Per-workspace inline editor inside the Settings dialog. Name + colour
 * autosave on every change (cheap, label-only mutations); the URL field
 * autosaves on blur after a quick http(s) validity check, so transient
 * invalid values mid-typing don't get persisted.
 */
function WorkspaceEditRow({ workspace }: { workspace: Workspace }): React.JSX.Element {
  const [draftUrl, setDraftUrl] = useState(workspace.serverUrl);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Keep the local URL draft in sync if the workspace is updated from
  // elsewhere (another window, IPC event) while this dialog is open.
  useEffect(() => {
    setDraftUrl(workspace.serverUrl);
  }, [workspace.serverUrl]);

  const commitUrl = () => {
    if (draftUrl === workspace.serverUrl) {
      setUrlError(null);
      return;
    }
    try {
      const parsed = new URL(draftUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('protocol');
      }
    } catch {
      setUrlError(t.workspaceRow.urlInvalid);
      return;
    }
    setUrlError(null);
    void ipc.workspace.update({ id: workspace.id, serverUrl: draftUrl });
  };

  return (
    <>
      <div className="workspace-edit-row">
        {/* The swatch IS the colour picker — clicking it opens the native
            colour chooser via the hidden input. Saves a column compared
            to a dedicated `<input type=color>` and removes the visual
            collision with the Remove button the user reported. */}
        <label
          className="workspace-edit-swatch"
          style={{ background: workspace.color }}
          title={t.workspaceRow.colorLabel}
          aria-label={t.workspaceRow.colorLabel}
        >
          <input
            type="color"
            className="visually-hidden"
            value={workspace.color}
            onChange={(e) => {
              void ipc.workspace.update({ id: workspace.id, color: e.target.value });
            }}
          />
        </label>
        <input
          className="workspace-edit-name"
          type="text"
          value={workspace.name}
          aria-label={t.workspaceRow.nameLabel}
          onChange={(e) => {
            void ipc.workspace.update({ id: workspace.id, name: e.target.value });
          }}
        />
        <button
          className="btn-secondary"
          onClick={() => dialogActions.openDialog('removeWorkspace', { workspaceId: workspace.id })}
        >
          {t.workspaceRow.remove}
        </button>
      </div>
      <div className="workspace-edit-url-row">
        <input
          className="workspace-edit-url"
          type="url"
          value={draftUrl}
          aria-label={t.workspaceRow.urlLabel}
          aria-invalid={urlError !== null}
          placeholder="https://pads.example.com"
          onChange={(e) => setDraftUrl(e.target.value)}
          onBlur={commitUrl}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitUrl();
            }
          }}
        />
        {urlError && (
          <span role="alert" className="workspace-edit-url-error">{urlError}</span>
        )}
      </div>
    </>
  );
}

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
        <h3>{t.workspaceRow.sectionHeading}</h3>
        {workspaces.map((ws) => (
          <WorkspaceEditRow key={ws.id} workspace={ws} />
        ))}
      </section>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn-primary" title={t.settings.save} onClick={() => void save()}>{t.settings.save}</button>
        <button className="btn-secondary" title={t.settings.cancel} onClick={() => dialogActions.closeDialog()}>{t.settings.cancel}</button>
      </div>
    </DialogShell>
  );
}
