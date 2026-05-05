import React from 'react';
import { useShellStore, dialogActions } from '../state/store.js';
import { ipc } from '../ipc/api.js';
import { t } from '../i18n/index.js';
import type { PadHistoryEntry } from '@shared/types/pad-history';

const EMPTY_HISTORY: never[] = [];

export function PadSidebar(): React.JSX.Element {
  const wsId = useShellStore((s) => s.activeWorkspaceId);
  const history = useShellStore((s) => (wsId ? s.padHistory[wsId] ?? EMPTY_HISTORY : EMPTY_HISTORY));

  if (!wsId) {
    return <aside style={{ background: 'var(--sidebar-bg)', height: '100%' }} aria-label="Pad sidebar" />;
  }

  const pinned = history.filter((e: PadHistoryEntry) => e.pinned);
  const recent = history.filter((e: PadHistoryEntry) => !e.pinned).slice(0, 50);

  const open = async (padName: string) => {
    await ipc.tab.open({ workspaceId: wsId, padName, mode: 'open' });
  };

  return (
    <aside
      aria-label="Pad sidebar"
      style={{ background: 'var(--sidebar-bg)', height: '100%', padding: 8, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <button
        className="sidebar-search"
        aria-label={t.sidebar.searchAllPads}
        title={t.sidebar.searchAllPads}
        onClick={() => dialogActions.openDialog('quickSwitcher')}
      >
        🔍 {t.sidebar.searchAllPads}
      </button>

      <button
        onClick={() => dialogActions.openDialog('openPad')}
        aria-label={t.sidebar.newPad}
        title={t.sidebar.newPad}
      >
        + {t.sidebar.newPad}
      </button>

      <div className="pad-sidebar-list">
        {pinned.length > 0 && (
          <section>
            <h3 style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>{t.sidebar.pinned}</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {pinned.map((e) => (
                <li key={e.padName} className="pad-row">
                  <button
                    className="pad-open"
                    onClick={() => void open(e.padName)}
                    title={e.title ?? e.padName}
                  >
                    {e.title ?? e.padName}
                  </button>
                  <button
                    className="pad-pin"
                    aria-label={`Unpin ${e.padName}`}
                    aria-pressed={true}
                    title={`Unpin ${e.padName}`}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      void ipc.padHistory.unpin(wsId, e.padName);
                    }}
                  >
                    ★
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>{t.sidebar.recent}</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {recent.map((e) => (
              <li key={e.padName} className="pad-row">
                <button
                  className="pad-open"
                  onClick={() => void open(e.padName)}
                  title={e.title ?? e.padName}
                >
                  {e.title ?? e.padName}
                </button>
                <button
                  className="pad-pin"
                  aria-label={`Pin ${e.padName}`}
                  aria-pressed={false}
                  title={`Pin ${e.padName}`}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    void ipc.padHistory.pin(wsId, e.padName);
                  }}
                >
                  ☆
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </aside>
  );
}
