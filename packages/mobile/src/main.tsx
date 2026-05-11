import React from 'react';
import { createRoot } from 'react-dom/client';
import { App, setPlatform } from '@etherpad/shell';
import { useShellStore } from '@etherpad/shell/state';
import '@etherpad/shell/styles/index.css';
import { createCapacitorPlatform } from './platform/capacitor.js';
import { handleUrl, installDeepLinkHandler } from './platform/deep-links.js';
import { onOpened as onTabOpened } from './platform/tabs/tab-store.js';
import { PadIframeStack } from './components/PadIframeStack.js';

// Wire the platform adapter before App renders. App and every IPC caller
// inside @etherpad/shell route through getPlatform().
const platform = createCapacitorPlatform();
setPlatform(platform);

// Expose the platform on `window` so Playwright tests can drive tab.open /
// settings.update / etc. directly without going through dialog flows that
// hit external servers (the URL probe in AddWorkspaceDialog can't pass under
// browser CORS). Harmless in production — mobile has no security boundary
// like desktop's preload, and the underlying Preferences are inspectable
// anyway via DevTools.
(window as unknown as {
  __test_platform?: typeof platform;
  __test_handleUrl?: typeof handleUrl;
}).__test_platform = platform;
(window as unknown as { __test_handleUrl?: typeof handleUrl }).__test_handleUrl = handleUrl;

// Register the deep-link listener once the platform is wired. The handler
// reads useShellStore so it sees fresh state on every URL even after
// workspaces are added later.
installDeepLinkHandler();

// Mobile UX rule: opening a pad collapses the workspace rail so the pad
// fills the screen. The user can still re-expand via the collapse handle.
// Doesn't fight subsequent manual opens — fires only on the open event.
onTabOpened(() => {
  if (!useShellStore.getState().railCollapsed) {
    useShellStore.getState().toggleRailCollapsed();
  }
});

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App padView={<PadIframeStack />} />
  </React.StrictMode>,
);
