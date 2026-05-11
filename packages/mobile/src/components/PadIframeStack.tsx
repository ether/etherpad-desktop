import React, { useEffect, useState } from 'react';
import { useShellStore } from '@etherpad/shell/state';
import { padUrl } from '@shared/url';
import { onReload, markLoaded, markError } from '../platform/tabs/tab-store.js';

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
 * X-Frame-Options DENY isn't handled here yet — Phase 6 adds an
 * `@capacitor/browser` fallback that opens the pad in the system in-app
 * browser when embedding is refused.
 */
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

  const dialogOpen = openDialog !== null;
  const visibleTabs = activeWorkspaceId
    ? tabs.filter((t) => t.workspaceId === activeWorkspaceId)
    : [];

  if (!workspace) return <></>;

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
        return (
          <iframe
            key={`${tab.tabId}#${reloadKey}`}
            src={src}
            data-pad-id={tab.tabId}
            title={tab.title ?? tab.padName}
            onLoad={() => markLoaded(tab.tabId)}
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
    </div>
  );
}
