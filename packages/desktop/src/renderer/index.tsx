import React from 'react';
import { createRoot } from 'react-dom/client';
import { App, setPlatform } from '@etherpad/shell';
import '@etherpad/shell/styles/index.css';
import { createElectronPlatform } from './platform.electron.js';

// Wire the platform adapter before App renders. App and every IPC caller
// inside @etherpad/shell route through getPlatform().
setPlatform(createElectronPlatform());

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
