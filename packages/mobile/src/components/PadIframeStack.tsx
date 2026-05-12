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
 * X-Frame-Options DENY / SAMEORIGIN: Chromium fires `onLoad` for blocked
 * iframes too (with about:blank content), so we can't reliably detect
 * blocked embedding from JS. The robust path is a native
 * WebChromeClient.onReceivedHttpError hook, which lands with the
 * permissions plugin in Phase 6b. Until then the user's escape hatch is
 * "Open in browser" — exposed via a long-press / overflow menu (TODO),
 * not a forced top-right button.
 */
export function PadIframeStack(): React.JSX.Element {
  const tabs = useShellStore((s) => s.tabs);
  const activeTabId = useShellStore((s) => s.activeTabId);
  const activeWorkspaceId = useShellStore((s) => s.activeWorkspaceId);
  const workspaces = useShellStore((s) => s.workspaces);
  const openDialog = useShellStore((s) => s.openDialog);
  const settings = useShellStore((s) => s.settings);
  const railCollapsed = useShellStore((s) => s.railCollapsed);

  const workspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const lang = settings?.language ?? 'en';
  const userName = settings?.userName ?? '';

  /**
   * Build the iframe src for a pad. Includes `?lang=` always; appends
   * `&userName=` when the user has set a display name in Settings —
   * Etherpad reads this query param to populate the guest user's name
   * without requiring the user to set it inside the pad UI every time.
   */
  const buildSrc = (padName: string): string => {
    const base = padUrl(workspace!.serverUrl, padName);
    const params = new URLSearchParams({ lang });
    if (userName) params.set('userName', userName);
    return `${base}?${params.toString()}`;
  };

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

  // Mobile drawer pattern: when the rail is expanded AND there's a pad
  // visible, tapping anywhere in the pad area should collapse the rail
  // (focus mode) rather than do nothing. We paint a transparent capture
  // div above the iframes that consumes the first tap, collapses the
  // rail, then unmounts itself so subsequent taps go through to the pad.
  // Hidden when no active pad (no useful collapse target) or when a
  // dialog is open (dialog handles its own backdrop).
  const showCollapseScrim = !railCollapsed
    && !dialogOpen
    && visibleTabs.some((t) => t.tabId === activeTabId);
  const collapseRailOnTap = (): void => {
    // Store update only — App.tsx's useEffect on railCollapsed fires the
    // IPC call which persists this through to windowState.
    useShellStore.getState().setRailCollapsed(true);
  };

  return (
    <div
      data-testid="pad-iframe-stack"
      style={{ position: 'absolute', inset: 0 }}
    >
      {visibleTabs.map((tab) => {
        const src = buildSrc(tab.padName);
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
      {showCollapseScrim && (
        <div
          data-testid="rail-collapse-scrim"
          aria-hidden="true"
          onPointerDown={collapseRailOnTap}
          style={{
            position: 'absolute',
            inset: 0,
            // Transparent — purely a tap target. CSS makes it sit above the
            // iframes (z-index) but below any dialog.
            zIndex: 5,
            background: 'transparent',
            // touchAction prevents the browser's default scroll-on-touch so
            // the gesture lands on this scrim, not the page below.
            touchAction: 'none',
          }}
        />
      )}
    </div>
  );
}
