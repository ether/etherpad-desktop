import React from 'react';
import { t } from '../i18n/index.js';

type Props = { onReload: () => void; children: React.ReactNode };
type State = { error: Error | null; showDetails: boolean };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, showDetails: false };

  static getDerivedStateFromError(error: Error): State {
    return { error, showDetails: false };
  }

  override componentDidCatch(): void {
    /* logged in main */
  }

  override render(): React.ReactNode {
    if (this.state.error) {
      const stack = this.state.error.toString() + '\n' + (this.state.error.stack ?? '');
      return (
        <div role="alert" style={{ padding: 24 }}>
          <h2>{t.errorBoundary.title}</h2>
          <button onClick={this.props.onReload}>{t.errorBoundary.reload}</button>{' '}
          <button onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}>
            {t.errorBoundary.showDetails}
          </button>
          {this.state.showDetails && (
            <pre style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{stack}</pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
