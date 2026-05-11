import React from 'react';
import { createRoot } from 'react-dom/client';
import { App, attachE2EHelpers, setPlatform } from '@etherpad/shell';
import '@etherpad/shell/styles/index.css';
import { createElectronPlatform } from './platform.electron.js';

// Wire the platform adapter before App renders. App and every IPC caller
// inside @etherpad/shell route through getPlatform().
setPlatform(createElectronPlatform());

// Expose store + dialog handles on `window` for Playwright E2E. Only when the
// preload reports the runtime is in E2E mode — never in user builds.
if (window.etherpadDesktop?.e2eFlags?.enabled) {
  attachE2EHelpers(window);
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
