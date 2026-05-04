import React from 'react';
import { dialogActions } from '../state/store.js';

export function AboutDialog(): React.JSX.Element {
  // App version comes from package.json at build time. Vite injects __APP_VERSION__
  // via define; if not configured, fall back to a constant.
  const version =
    typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0';

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="about-title" style={overlayStyle}>
      <div style={panelStyle}>
        <h2 id="about-title" style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          Etherpad Desktop
        </h2>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Version {version}</p>
        <p style={{ margin: '8px 0 0' }}>
          Native desktop client for{' '}
          <a
            href="https://etherpad.org/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'none' }}
          >
            Etherpad
          </a>
          .
        </p>
        <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
          Released under the Apache-2.0 license. Source on{' '}
          <a
            href="https://github.com/ether/etherpad-desktop"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'none' }}
          >
            GitHub
          </a>
          .
        </p>
        <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
          Made by the Etherpad Foundation and contributors.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn-primary" onClick={() => dialogActions.closeDialog()}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--modal-overlay-bg)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 100,
};
const panelStyle: React.CSSProperties = {
  background: 'var(--panel-bg)',
  color: 'var(--panel-fg)',
  padding: 24,
  borderRadius: 12,
  width: 380,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  boxShadow: 'var(--panel-shadow)',
  border: '1px solid var(--panel-border)',
};
