import React from 'react';
import { dialogActions } from '../state/store.js';
import { t } from '../i18n/index.js';

export function EmptyState(): React.JSX.Element {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
      <div style={{ textAlign: 'center' }}>
        <p>{t.emptyState.noPads}</p>
        <button className="btn-primary" onClick={() => dialogActions.openDialog('openPad')}>{t.emptyState.openPad}</button>
      </div>
    </div>
  );
}
