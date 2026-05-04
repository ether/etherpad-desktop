import React from 'react';
import { dialogActions } from '../state/store.js';
import { t } from '../i18n/index.js';

export function EmptyState(): JSX.Element {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#6b7280' }}>
      <div style={{ textAlign: 'center' }}>
        <p>{t.emptyState.noPads}</p>
        <button onClick={() => dialogActions.openDialog('openPad')}>{t.emptyState.openPad}</button>
      </div>
    </div>
  );
}
