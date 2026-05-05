import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ipc } from '../ipc/api.js';
import { dialogActions, useShellStore } from '../state/store.js';
import { t } from '../i18n/index.js';
import type { Workspace } from '@shared/types/workspace';
import type { PadHistoryEntry } from '@shared/types/pad-history';

type WorkspaceResult = { kind: 'workspace'; workspace: Workspace };
type PadResult = { kind: 'pad'; entry: PadHistoryEntry; workspace: Workspace };
type PadContentResult = {
  kind: 'pad-content';
  entry: PadHistoryEntry;
  workspace: Workspace;
  snippet: string;
};
type Result = WorkspaceResult | PadResult | PadContentResult;

const RESULT_CAP = 30;
const RECENT_CAP = 10;
const CONTENT_CAP = 20;
const CONTENT_DEBOUNCE_MS = 200;

function rankResults(
  query: string,
  workspaces: Workspace[],
  history: Record<string, PadHistoryEntry[]>,
): Array<WorkspaceResult | PadResult> {
  const q = query.trim().toLowerCase();
  const wsById = Object.fromEntries(workspaces.map((w) => [w.id, w]));

  if (!q) {
    // Empty query → most recent pads across all workspaces.
    const allPads: PadResult[] = Object.values(history)
      .flat()
      .filter((e) => wsById[e.workspaceId])
      .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
      .slice(0, RECENT_CAP)
      .map((entry) => ({ kind: 'pad' as const, entry, workspace: wsById[entry.workspaceId]! }));
    return allPads;
  }

  const wsHits: WorkspaceResult[] = workspaces
    .filter((w) => w.name.toLowerCase().includes(q))
    .map((workspace) => ({ kind: 'workspace' as const, workspace }));

  const padHits: PadResult[] = Object.values(history)
    .flat()
    .filter((e) => {
      if (!wsById[e.workspaceId]) return false;
      return (
        e.padName.toLowerCase().includes(q) ||
        (e.title?.toLowerCase().includes(q) ?? false)
      );
    })
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
    .map((entry) => ({ kind: 'pad' as const, entry, workspace: wsById[entry.workspaceId]! }));

  return [...wsHits, ...padHits].slice(0, RESULT_CAP);
}

export function QuickSwitcherDialog(): React.JSX.Element {
  const workspaces = useShellStore((s) => s.workspaces);
  const padHistory = useShellStore((s) => s.padHistory);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [contentResults, setContentResults] = useState<PadContentResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const wsById = useMemo(
    () => Object.fromEntries(workspaces.map((w) => [w.id, w])),
    [workspaces],
  );

  // Build pad-history lookup (flat list keyed by workspaceId::padName)
  const padByKey = useMemo(() => {
    const map = new Map<string, PadHistoryEntry>();
    for (const entries of Object.values(padHistory)) {
      for (const e of entries) {
        map.set(`${e.workspaceId}::${e.padName}`, e);
      }
    }
    return map;
  }, [padHistory]);

  const nameResults = useMemo(
    () => rankResults(query, workspaces, padHistory),
    [query, workspaces, padHistory],
  );

  const allResults: Result[] = [...nameResults, ...contentResults];

  // Debounced content search
  useEffect(() => {
    if (!query.trim()) {
      setContentResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void ipc.quickSwitcher.searchPadContent(query).then((hits) => {
        const mapped: PadContentResult[] = hits
          .slice(0, CONTENT_CAP)
          .flatMap((h) => {
            const ws = wsById[h.workspaceId];
            if (!ws) return [];
            const entry = padByKey.get(`${h.workspaceId}::${h.padName}`);
            if (!entry) {
              // Not in pad history yet — skip rendering
              return [];
            }
            return [{ kind: 'pad-content' as const, entry, workspace: ws, snippet: h.snippet }];
          });
        setContentResults(mapped);
      }).catch(() => {
        // Content search unavailable (auth required, etc.) — silent fail
        setContentResults([]);
      });
    }, CONTENT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, wsById, padByKey]);

  // Reset selection when results change
  useEffect(() => setSelected(0), [allResults.length, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const activateNameResult = async (r: WorkspaceResult | PadResult) => {
    if (r.kind === 'workspace') {
      useShellStore.getState().setActiveWorkspaceId(r.workspace.id);
      await ipc.window.setActiveWorkspace(r.workspace.id);
    } else {
      useShellStore.getState().setActiveWorkspaceId(r.workspace.id);
      await ipc.window.setActiveWorkspace(r.workspace.id);
      await ipc.tab.open({ workspaceId: r.workspace.id, padName: r.entry.padName, mode: 'open' });
    }
    dialogActions.closeDialog();
  };

  const activateContentResult = async (r: PadContentResult) => {
    useShellStore.getState().setActiveWorkspaceId(r.workspace.id);
    await ipc.window.setActiveWorkspace(r.workspace.id);
    await ipc.tab.open({ workspaceId: r.workspace.id, padName: r.entry.padName, mode: 'open' });
    dialogActions.closeDialog();
  };

  const activate = async (r: Result) => {
    if (r.kind === 'pad-content') {
      await activateContentResult(r);
    } else {
      await activateNameResult(r);
    }
  };

  const onKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, Math.max(allResults.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = allResults[selected];
      if (r) await activate(r);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      dialogActions.closeDialog();
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="qs-title" style={overlayStyle}>
      <div style={panelStyle} onKeyDown={(e) => void onKeyDown(e)}>
        <h2 id="qs-title" className="qs-title">{t.quickSwitcher.title}</h2>
        <input
          ref={inputRef}
          className="qs-input"
          type="text"
          placeholder={t.quickSwitcher.placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t.quickSwitcher.inputAria}
        />
        {allResults.length === 0 ? (
          <p className="qs-empty">{query ? t.quickSwitcher.noMatches : t.quickSwitcher.empty}</p>
        ) : (
          <ul className="qs-results" role="listbox" aria-label={t.quickSwitcher.resultsAria}>
            {allResults.map((r, i) => {
              const id =
                r.kind === 'workspace'
                  ? `ws-${r.workspace.id}`
                  : r.kind === 'pad-content'
                  ? `content-${r.workspace.id}-${r.entry.padName}`
                  : `pad-${r.workspace.id}-${r.entry.padName}`;
              const isSelected = i === selected;
              return (
                <li
                  key={id}
                  role="option"
                  aria-selected={isSelected}
                  className={`qs-row${isSelected ? ' qs-row-selected' : ''}`}
                  onClick={() => void activate(r)}
                  onMouseEnter={() => setSelected(i)}
                >
                  <span
                    className="qs-dot"
                    style={{ background: r.workspace.color }}
                    aria-hidden="true"
                  />
                  <span className="qs-primary">
                    {r.kind === 'workspace'
                      ? r.workspace.name
                      : (r.entry.title ?? r.entry.padName)}
                  </span>
                  {r.kind === 'pad-content' ? (
                    <span className="qs-secondary qs-snippet">{r.snippet}</span>
                  ) : (
                    <span className="qs-secondary">
                      {r.kind === 'workspace'
                        ? t.quickSwitcher.workspaceLabel
                        : r.workspace.name}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="qs-hint">{t.quickSwitcher.kbdHint}</p>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--modal-overlay-bg)',
  display: 'grid',
  placeItems: 'start center',
  paddingTop: 100,
  zIndex: 100,
};

const panelStyle: React.CSSProperties = {
  background: 'var(--panel-bg)',
  color: 'var(--panel-fg)',
  padding: 16,
  borderRadius: 12,
  width: 540,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  boxShadow: 'var(--panel-shadow)',
  border: '1px solid var(--panel-border)',
};
