import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@etherpad/shell';
import '@etherpad/shell/styles/index.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
