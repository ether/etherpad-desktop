import React from 'react';
import { useShellStore } from '../state/store.js';
import { ipc } from '../ipc/api.js';
import { t } from '../i18n/index.js';

export function TabStrip(): React.JSX.Element {
  const activeId = useShellStore((s) => s.activeWorkspaceId);
  const allTabs = useShellStore((s) => s.tabs);
  const tabs = activeId ? allTabs.filter((tab) => tab.workspaceId === activeId) : [];
  const activeTabId = useShellStore((s) => s.activeTabId);

  return (
    <div
      role="tablist"
      style={{ display: 'flex', height: 40, background: 'var(--tab-strip-bg)', alignItems: 'flex-end', borderBottom: '1px solid var(--tab-border)' }}
    >
      {tabs.map((tab) => (
        <div
          key={tab.tabId}
          role="tab"
          aria-selected={tab.tabId === activeTabId}
          title={tab.title ?? tab.padName}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 12px',
            height: 36,
            background: tab.tabId === activeTabId ? 'var(--tab-bg-active)' : 'var(--tab-bg-inactive)',
            border: '1px solid var(--tab-border)',
            borderBottom: 'none',
            boxShadow: tab.tabId === activeTabId ? 'inset 0 -2px 0 var(--accent)' : 'none',
            marginRight: 4,
            cursor: 'pointer',
            maxWidth: 240,
          }}
        >
          {tab.state === 'error' || tab.state === 'crashed' ? (
            <span aria-label="Error" style={{ color: 'var(--error)' }}>
              ●
            </span>
          ) : null}
          <span onClick={() => void ipc.tab.focus({ tabId: tab.tabId })} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {tab.title}
          </span>
          <button
            aria-label={t.tabStrip.close}
            title={t.tabStrip.close}
            onClick={() => void ipc.tab.close({ tabId: tab.tabId })}
            style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
