import React, { useMemo, useState } from 'react';
import { ipc } from '../platform/ipc.js';
import { dialogActions, useShellStore } from '../state/store.js';
import { t } from '../i18n/index.js';
import { DialogShell } from '../components/DialogShell.js';
import type { PadHistoryEntry } from '@shared/types/pad-history';
import type { Workspace } from '@shared/types/workspace';

/**
 * Open-or-create a pad. The text field auto-suggests pads from EVERY
 * workspace's history (not just the active one) so the user can switch
 * + open in one action — matching the cross-instance suggestion model
 * the QuickSwitcher already uses, but framed as "open a pad" so the
 * primary action stays "create or open by name in the active
 * workspace" rather than "jump to one you've seen before".
 *
 * Behaviour:
 *  - Typing a name → suggestions: every pad-history entry whose name
 *    (or whose workspace name) substring-matches, deduped by
 *    `${workspaceId}::${padName}`, capped at 8. Each row shows the
 *    workspace colour dot + the workspace name so cross-instance pads
 *    are unambiguous.
 *  - Click a suggestion → switch to that workspace (if different) and
 *    open the pad.
 *  - Submit (Enter or Open button) → open the typed name in the
 *    CURRENT active workspace. Etherpad's `/p/<name>` URL is
 *    open-or-create at the server, so this works whether the pad
 *    exists or not — the "Create new" checkbox is intentionally gone.
 */

type Suggestion = { entry: PadHistoryEntry; workspace: Workspace };

export function OpenPadDialog(): React.JSX.Element {
  const wsId = useShellStore((s) => s.activeWorkspaceId);
  const workspaces = useShellStore((s) => s.workspaces);
  const padHistory = useShellStore((s) => s.padHistory);
  const [name, setName] = useState('');

  const wsById = useMemo(
    () => new Map(workspaces.map((w) => [w.id, w])),
    [workspaces],
  );

  // Flatten all pads across all workspaces, with their workspace
  // attached. Most-recently-opened first so the suggestions surface
  // what the user touched recently.
  const allPads = useMemo<Suggestion[]>(() => {
    const out: Suggestion[] = [];
    for (const [id, entries] of Object.entries(padHistory)) {
      const ws = wsById.get(id);
      if (!ws) continue;
      for (const entry of entries) out.push({ entry, workspace: ws });
    }
    out.sort((a, b) => b.entry.lastOpenedAt - a.entry.lastOpenedAt);
    return out;
  }, [padHistory, wsById]);

  const matches = useMemo<Suggestion[]>(() => {
    const q = name.trim().toLowerCase();
    if (!q) return [];
    return allPads
      .filter(({ entry, workspace }) => {
        const padHit = entry.padName.toLowerCase().includes(q)
          || (entry.title ? entry.title.toLowerCase().includes(q) : false);
        const wsHit = workspace.name.toLowerCase().includes(q);
        return padHit || wsHit;
      })
      .slice(0, 8);
  }, [name, allPads]);

  const openSuggestion = async (s: Suggestion): Promise<void> => {
    // Switch workspace first if the suggestion lives elsewhere — the
    // tab IPC opens in whatever workspace it's asked, but having the
    // rail follow the user's selection is the expected UX.
    if (s.workspace.id !== wsId) {
      useShellStore.getState().setActiveWorkspaceId(s.workspace.id);
      await ipc.window.setActiveWorkspace(s.workspace.id);
    }
    await ipc.tab.open({
      workspaceId: s.workspace.id,
      padName: s.entry.padName,
      mode: 'open',
    });
    dialogActions.closeDialog();
  };

  const submitTyped = async (): Promise<void> => {
    if (!wsId || !name.trim()) return;
    await ipc.tab.open({ workspaceId: wsId, padName: name.trim(), mode: 'open' });
    dialogActions.closeDialog();
  };

  return (
    <DialogShell labelledBy="open-pad-title">
      <h2 id="open-pad-title">{t.openPad.title}</h2>
      <label className="dialog-field">
        <span className="dialog-label">{t.openPad.label}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches[0]) {
              // Enter on a populated suggestion list opens the first
              // match — same convention as QuickSwitcher / OS Spotlight.
              e.preventDefault();
              void openSuggestion(matches[0]);
            }
          }}
        />
      </label>
      {matches.length > 0 && (
        <ul
          role="listbox"
          style={{ listStyle: 'none', padding: 0, margin: 0, border: '1px solid var(--panel-border)' }}
        >
          {matches.map((s) => (
            <li
              key={`${s.workspace.id}::${s.entry.padName}`}
              role="option"
              aria-selected={false}
            >
              <button
                type="button"
                onClick={() => void openSuggestion(s)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: s.workspace.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.entry.title ?? s.entry.padName}
                </span>
                <span
                  style={{ color: 'var(--text-muted)', fontSize: '0.85em', marginLeft: 'auto' }}
                >
                  {s.workspace.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          className="btn-primary"
          title={t.openPad.submit}
          onClick={() => void submitTyped()}
          disabled={!name.trim()}
        >
          {t.openPad.submit}
        </button>
        <button
          className="btn-secondary"
          title={t.addWorkspace.cancel}
          onClick={() => dialogActions.closeDialog()}
        >
          {t.addWorkspace.cancel}
        </button>
      </div>
    </DialogShell>
  );
}
