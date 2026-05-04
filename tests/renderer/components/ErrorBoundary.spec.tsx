import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from '../../../src/renderer/components/ErrorBoundary';

function Boom(): JSX.Element {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary onReload={() => {}}>
        <p>ok</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('ok')).toBeInTheDocument();
  });

  it('renders fallback on render error and calls onReload', async () => {
    const onReload = vi.fn();
    // suppress react's error log noise
    const orig = console.error;
    console.error = () => {};
    try {
      render(
        <ErrorBoundary onReload={onReload}>
          <Boom />
        </ErrorBoundary>,
      );
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /reload window/i }));
      expect(onReload).toHaveBeenCalledTimes(1);
    } finally {
      console.error = orig;
    }
  });

  it('show details toggles trace', async () => {
    const orig = console.error;
    console.error = () => {};
    try {
      render(
        <ErrorBoundary onReload={() => {}}>
          <Boom />
        </ErrorBoundary>,
      );
      await userEvent.click(screen.getByRole('button', { name: /show details/i }));
      expect(screen.getByText(/Error: boom/)).toBeInTheDocument();
    } finally {
      console.error = orig;
    }
  });
});
