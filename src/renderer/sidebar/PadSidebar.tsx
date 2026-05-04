import React from 'react';
import { useShellStore, dialogActions } from '../state/store.js';
import { ipc } from '../ipc/api.js';
import { t } from '../i18n/index.js';

const EMPTY_HISTORY: never[] = [];

export function PadSidebar(): JSX.Element {
  const wsId = useShellStore((s) => s.activeWorkspaceId);
  const history = useShellStore((s) => (wsId ? s.padHistory[wsId] ?? EMPTY_HISTORY : EMPTY_HISTORY));

  if (!wsId) {
    return <aside style={{ background: 'var(--sidebar-bg)', height: '100%' }} aria-label="Pad sidebar" />;
  }

  const pinned = history.filter((e) => e.pinned);
  const recent = history.filter((e) => !e.pinned).slice(0, 50);

  const open = async (padName: string) => {
    await ipc.tab.open({ workspaceId: wsId, padName, mode: 'open' });
  };

  return (
    <aside
      aria-label="Pad sidebar"
      style={{ background: 'var(--sidebar-bg)', height: '100%', padding: 8, overflowY: 'auto' }}
    >
      <button onClick={() => dialogActions.openDialog('openPad')} aria-label={t.sidebar.newPad}>
        + {t.sidebar.newPad}
      </button>

      {pinned.length > 0 && (
        <section>
          <h3 style={{ fontSize: 12, color: '#6b7280', marginTop: 16 }}>{t.sidebar.pinned}</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {pinned.map((e) => (
              <li key={e.padName}>
                <button onClick={() => void open(e.padName)} style={{ width: '100%', textAlign: 'left', padding: 4 }}>
                  {e.title ?? e.padName}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 style={{ fontSize: 12, color: '#6b7280', marginTop: 16 }}>{t.sidebar.recent}</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {recent.map((e) => (
            <li key={e.padName}>
              <button onClick={() => void open(e.padName)} style={{ width: '100%', textAlign: 'left', padding: 4 }}>
                {e.title ?? e.padName}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
