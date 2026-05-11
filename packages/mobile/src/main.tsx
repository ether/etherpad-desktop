import React from 'react';
import { createRoot } from 'react-dom/client';
import { App, setPlatform } from '@etherpad/shell';
import '@etherpad/shell/styles/index.css';
import { createCapacitorPlatform } from './platform/capacitor.js';
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
(window as unknown as { __test_platform?: typeof platform }).__test_platform = platform;

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App padView={<PadIframeStack />} />
  </React.StrictMode>,
);
