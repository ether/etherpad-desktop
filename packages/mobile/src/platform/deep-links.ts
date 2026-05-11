import { App } from '@capacitor/app';
import { parsePadUrl } from '@shared/url';
import { dialogActions, useShellStore } from '@etherpad/shell/state';
import * as tabStore from './tabs/tab-store.js';

/**
 * Wire up the deep-link handler. Returns a function that removes the
 * listener (useful for tests; in production we set-and-forget for the app
 * lifetime).
 *
 * Supports two URL families per spec §7:
 *   - `etherpad://<host>/p/<pad>`  — custom scheme; declared in
 *     AndroidManifest as a `<data android:scheme="etherpad" />` intent
 *     filter so Android dispatches it to us.
 *   - `https://<host>/p/<pad>`     — HTTPS app links; `android:autoVerify`
 *     lets the OS skip the chooser dialog for hosts that publish a
 *     matching `assetlinks.json`.
 *
 * Match-by-origin against existing workspaces. On match, open the pad;
 * on miss, prompt to add the workspace (the dialog can be pre-seeded
 * via `dialogContext` when AddWorkspaceDialog learns to read it).
 */
export function installDeepLinkHandler(): () => void {
  let removed = false;
  let off: (() => void) | undefined;
  void App.addListener('appUrlOpen', ({ url }) => {
    handleUrl(url);
  }).then((sub) => {
    if (removed) {
      void sub.remove();
      return;
    }
    off = (): void => {
      void sub.remove();
    };
  });
  return () => {
    removed = true;
    off?.();
  };
}

/**
 * Exposed for tests. Parses an incoming URL and dispatches it through
 * the platform — either tab.open into an existing workspace or
 * openDialog('addWorkspace') seeded with the new origin.
 */
export function handleUrl(url: string): void {
  // Capacitor delivers the URL with its original scheme. Normalise
  // `etherpad:` → `https:` so `parsePadUrl` (which is HTTPS-only) accepts it.
  const normalised = url.replace(/^etherpad:/, 'https:');
  const parsed = parsePadUrl(normalised);
  if (!parsed) return;
  const { serverUrl, padName } = parsed;

  const state = useShellStore.getState();
  const ws = state.workspaces.find(
    (w) => normaliseOrigin(w.serverUrl) === normaliseOrigin(serverUrl),
  );
  if (ws) {
    state.setActiveWorkspaceId(ws.id);
    tabStore.open({ workspaceId: ws.id, padName });
  } else {
    dialogActions.openDialog('addWorkspace', {
      initialServerUrl: serverUrl,
      initialPadName: padName,
    });
  }
}

function normaliseOrigin(input: string): string {
  try {
    return new URL(input).origin;
  } catch {
    return input;
  }
}
