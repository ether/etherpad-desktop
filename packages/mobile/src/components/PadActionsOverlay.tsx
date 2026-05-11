import React from 'react';
import { Browser } from '@capacitor/browser';
import { Share } from '@capacitor/share';

/**
 * Floating top-right action group rendered over the currently-visible
 * iframe. Two affordances:
 *
 *  - **Share** — invokes the OS share sheet via `@capacitor/share`. On the
 *    web fallback the plugin uses `navigator.share` when available, and
 *    falls back to writing the URL to the clipboard. This is what lets the
 *    user send a pad to another app from inside the mobile shell.
 *  - **Open in external browser** — invokes `@capacitor/browser` which
 *    opens a Chrome Custom Tab on Android (SFSafariViewController on iOS).
 *    Doubles as the user-driven X-Frame-Options DENY escape hatch: if a
 *    pad refuses to embed, the user always has this button.
 *
 * The overlay is only mounted when there's an active tab and no shell
 * dialog is open — see PadIframeStack for the gating.
 */
export interface PadActionsOverlayProps {
  url: string;
  title: string;
}

export function PadActionsOverlay({ url, title }: PadActionsOverlayProps): React.JSX.Element {
  return (
    <div
      data-testid="pad-actions-overlay"
      style={{
        position: 'absolute',
        top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        right: 'calc(env(safe-area-inset-right, 0px) + 8px)',
        display: 'flex',
        gap: 6,
        zIndex: 10,
      }}
    >
      <button
        type="button"
        aria-label="Share pad URL"
        title="Share pad URL"
        onClick={() => {
          void Share.share({ url, title }).catch(() => {
            // Share can reject when the user cancels the sheet or when no
            // share handler is available; we silently ignore.
          });
        }}
        style={actionButtonStyle}
      >
        📤
      </button>
      <button
        type="button"
        aria-label="Open in external browser"
        title="Open in external browser"
        onClick={() => {
          void Browser.open({ url }).catch(() => {});
        }}
        style={actionButtonStyle}
      >
        ↗
      </button>
    </div>
  );
}

const actionButtonStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.55)',
  color: 'white',
  border: 'none',
  borderRadius: 18,
  fontSize: 16,
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
};
