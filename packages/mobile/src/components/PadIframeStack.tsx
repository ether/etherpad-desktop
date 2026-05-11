import React, { useEffect, useState } from 'react';
import { Browser } from '@capacitor/browser';
import { useShellStore } from '@etherpad/shell/state';
import { padUrl } from '@shared/url';
import { onReload, markLoaded, markError } from '../platform/tabs/tab-store.js';
import { PadActionsOverlay } from './PadActionsOverlay.js';

/**
 * Mobile pad rendering: one DOM `<iframe>` per open tab, exactly one visible
 * at a time, all hidden when a dialog is open. Replaces desktop's native
 * `WebContentsView` model with same invariants:
 *
 *  - Iframes stay mounted while their tab is open — switching tabs is
 *    instant and any in-pad WebSocket survives.
 *  - When the active workspace changes, iframes for the previous workspace
 *    unmount (they're filtered out of the rendered set).
 *  - When a dialog opens, every iframe is hidden so the shell's dialog
 *    paints unobstructed.
 *  - `iframe.sandbox` is NOT set — Etherpad needs same-origin behavior
 *    (per design spec §5).
 *
 * Language switching reloads the iframe via a `?lang=<code>` query param
 * in the src — mirrors desktop's `webContents.loadURL` rule.
 *
 * X-Frame-Options DENY fallback: the iframe's `load` event fires even on
 * blocked content, but the document inside ends up with about:blank /
 * zero contentDocument. We use a 6-second timeout from mount: if no
 * onLoad has fired by then, surface a prominent "Open in browser" panel
 * over the iframe so the user has an obvious escape hatch.
 */
const X_FRAME_TIMEOUT_MS = 6_000;

export function PadIframeStack(): React.JSX.Element {
  const tabs = useShellStore((s) => s.tabs);
  const activeTabId = useShellStore((s) => s.activeTabId);
  const activeWorkspaceId = useShellStore((s) => s.activeWorkspaceId);
  const workspaces = useShellStore((s) => s.workspaces);
  const openDialog = useShellStore((s) => s.openDialog);
  const settings = useShellStore((s) => s.settings);

  const workspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const lang = settings?.language ?? 'en';

  // Per-tab reload counter so platform.tab.reload() forces the iframe to
  // remount (changing the src isn't enough if the URL is identical).
  const [reloadKeys, setReloadKeys] = useState<Record<string, number>>({});
  useEffect(() => {
    const off = onReload(({ tabId }) => {
      setReloadKeys((prev) => ({ ...prev, [tabId]: (prev[tabId] ?? 0) + 1 }));
    });
    return off;
  }, []);

  // Per-tab load-status. `pending` until onLoad fires; flips to `blocked`
  // if the timeout trips first.
  const [loadStatus, setLoadStatus] = useState<Record<string, 'pending' | 'loaded' | 'blocked'>>({});
  useEffect(() => {
    // For every active iframe that's still `pending`, kick off a timeout.
    const cleanups: Array<() => void> = [];
    for (const tab of tabs) {
      const key = `${tab.tabId}#${reloadKeys[tab.tabId] ?? 0}`;
      if (loadStatus[key]) continue;
      setLoadStatus((prev) => ({ ...prev, [key]: 'pending' }));
      const handle = setTimeout(() => {
        setLoadStatus((prev) => (prev[key] === 'pending' ? { ...prev, [key]: 'blocked' } : prev));
      }, X_FRAME_TIMEOUT_MS);
      cleanups.push(() => clearTimeout(handle));
    }
    return () => cleanups.forEach((c) => c());
  }, [tabs, reloadKeys, loadStatus]);

  const dialogOpen = openDialog !== null;
  const visibleTabs = activeWorkspaceId
    ? tabs.filter((t) => t.workspaceId === activeWorkspaceId)
    : [];

  if (!workspace) return <></>;

  const activeTab = visibleTabs.find((t) => t.tabId === activeTabId);
  const activePadUrl = activeTab
    ? `${padUrl(workspace.serverUrl, activeTab.padName)}?lang=${encodeURIComponent(lang)}`
    : null;
  const showActions = activeTab !== undefined && !dialogOpen;
  const activeKey = activeTab ? `${activeTab.tabId}#${reloadKeys[activeTab.tabId] ?? 0}` : null;
  const activeBlocked = activeKey ? loadStatus[activeKey] === 'blocked' : false;

  return (
    <div
      data-testid="pad-iframe-stack"
      style={{ position: 'absolute', inset: 0 }}
    >
      {visibleTabs.map((tab) => {
        const baseSrc = padUrl(workspace.serverUrl, tab.padName);
        const src = `${baseSrc}?lang=${encodeURIComponent(lang)}`;
        const isActive = tab.tabId === activeTabId && !dialogOpen;
        const reloadKey = reloadKeys[tab.tabId] ?? 0;
        const key = `${tab.tabId}#${reloadKey}`;
        return (
          <iframe
            key={key}
            src={src}
            data-pad-id={tab.tabId}
            title={tab.title ?? tab.padName}
            onLoad={() => {
              markLoaded(tab.tabId);
              setLoadStatus((prev) => ({ ...prev, [key]: 'loaded' }));
            }}
            onError={() => markError(tab.tabId, 'iframe load failed')}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              border: 'none',
              display: isActive ? 'block' : 'none',
            }}
          />
        );
      })}
      {showActions && activeTab && activePadUrl ? (
        <PadActionsOverlay url={activePadUrl} title={activeTab.title ?? activeTab.padName} />
      ) : null}
      {activeBlocked && activePadUrl ? (
        <div
          data-testid="pad-iframe-blocked"
          role="alert"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 15, lineHeight: 1.4, maxWidth: 320, margin: 0 }}>
            This pad didn&rsquo;t load inside the app. The Etherpad server may
            refuse to be embedded (X-Frame-Options).
          </p>
          <button
            type="button"
            onClick={() => {
              void Browser.open({ url: activePadUrl });
            }}
            style={{
              background: 'var(--accent, #44b492)',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              padding: '12px 20px',
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Open in browser
          </button>
        </div>
      ) : null}
    </div>
  );
}
