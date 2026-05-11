import React from 'react';
import { createRoot } from 'react-dom/client';
import { App, setPlatform } from '@etherpad/shell';
import '@etherpad/shell/styles/index.css';
import { createCapacitorPlatform } from './platform/capacitor.js';

// Wire the platform adapter before App renders. App and every IPC caller
// inside @etherpad/shell route through getPlatform().
setPlatform(createCapacitorPlatform());

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
