// tests/renderer/components/EmptyState.spec.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from '../../src/components/EmptyState';
import { useShellStore } from '../../src/state/store';

beforeEach(() => useShellStore.setState(useShellStore.getInitialState()));

describe('EmptyState', () => {
  it('shows a button that opens the OpenPadDialog when clicked', async () => {
    render(<EmptyState />);
    expect(screen.getByText(/no pads open/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /open pad/i }));
    expect(useShellStore.getState().openDialog).toBe('openPad');
  });
});
