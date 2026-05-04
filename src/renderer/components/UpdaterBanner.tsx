import React from 'react';
import { ipc } from '../ipc/api.js';
import { useShellStore } from '../state/store.js';
import { t, fmt } from '../i18n/index.js';

export function UpdaterBanner(): React.JSX.Element | null {
  const s = useShellStore((st) => st.updaterState);

  if (
    s.kind === 'idle' ||
    s.kind === 'checking' ||
    s.kind === 'unsupported' ||
    s.kind === 'available'
  ) {
    return null;
  }

  if (s.kind === 'downloading') {
    return (
      <div role="status" className="updater-banner updater-banner-info">
        {fmt(t.updater.downloading, { percent: String(s.percent) })}
      </div>
    );
  }

  if (s.kind === 'error') {
    return (
      <div role="alert" className="updater-banner updater-banner-warn">
        {t.updater.errorPrefix} {s.message}
      </div>
    );
  }

  // kind === 'ready'
  return (
    <div role="status" className="updater-banner updater-banner-ready">
      <span>{fmt(t.updater.readyPrefix, { version: s.version })}</span>
      <span className="updater-banner-actions">
        <button className="btn-primary" onClick={() => void ipc.updater.installAndRestart()}>
          {t.updater.restartNow}
        </button>
      </span>
    </div>
  );
}
