import React from 'react';
import { ipc } from '../ipc/api.js';
import { useShellStore } from '../state/store.js';
import { t } from '../i18n/index.js';

export function TabErrorOverlay(): JSX.Element | null {
  const wsId = useShellStore((s) => s.activeWorkspaceId);
  const tabs = useShellStore((s) => s.tabs);
  const activeId = useShellStore((s) => s.activeTabId);
  const tab = tabs.find((tab) => tab.tabId === activeId);
  const ws = useShellStore((s) => s.workspaces.find((w) => w.id === wsId));
  if (!tab || (tab.state !== 'error' && tab.state !== 'crashed')) return null;

  const message = tab.state === 'crashed' ? t.tabError.crashed : `${tab.errorMessage ?? t.tabError.cantReach.replace('{{url}}', ws?.serverUrl ?? '')}`;

  return (
    <div role="alert" style={{ position: 'absolute', inset: 0, background: 'rgba(239,68,68,0.06)', display: 'grid', placeItems: 'center', padding: 32 }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <p style={{ color: 'var(--error)', fontWeight: 600 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button className="btn-primary" onClick={() => void ipc.tab.reload({ tabId: tab.tabId })}>
            {tab.state === 'crashed' ? t.tabError.reload : t.tabError.retry}
          </button>
          <button className="btn-secondary" onClick={() => void ipc.tab.close({ tabId: tab.tabId })}>{t.tabError.closeTab}</button>
        </div>
      </div>
    </div>
  );
}
