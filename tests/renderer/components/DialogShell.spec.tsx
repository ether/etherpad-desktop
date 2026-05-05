// tests/renderer/components/DialogShell.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DialogShell } from '../../../src/renderer/components/DialogShell';
import { useShellStore, dialogActions } from '../../../src/renderer/state/store';

beforeEach(() => {
  useShellStore.setState(useShellStore.getInitialState());
  dialogActions.openDialog('openPad');
});

describe('DialogShell', () => {
  it('renders children inside a role=dialog', () => {
    render(
      <DialogShell labelledBy="test-title">
        <h2 id="test-title">Hello</h2>
        <p>World</p>
      </DialogShell>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('World')).toBeInTheDocument();
  });

  it('pressing Escape calls onDismiss', () => {
    const onDismiss = vi.fn();
    render(
      <DialogShell labelledBy="test-title" onDismiss={onDismiss}>
        <h2 id="test-title">Dialog</h2>
      </DialogShell>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('pressing Escape calls dialogActions.closeDialog when no onDismiss provided', () => {
    render(
      <DialogShell labelledBy="test-title">
        <h2 id="test-title">Dialog</h2>
      </DialogShell>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useShellStore.getState().openDialog).toBeNull();
  });

  it('clicking the overlay directly calls onDismiss', () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <DialogShell labelledBy="test-title" onDismiss={onDismiss}>
        <h2 id="test-title">Dialog</h2>
      </DialogShell>,
    );
    const overlay = container.querySelector('.dialog-overlay')!;
    // Simulate click directly on overlay (target === overlay)
    fireEvent.mouseDown(overlay, { target: overlay });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('clicking inside the panel does NOT call onDismiss', () => {
    const onDismiss = vi.fn();
    render(
      <DialogShell labelledBy="test-title" onDismiss={onDismiss}>
        <h2 id="test-title">Dialog</h2>
        <button>Inside</button>
      </DialogShell>,
    );
    const innerBtn = screen.getByRole('button', { name: 'Inside' });
    fireEvent.mouseDown(innerBtn);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('dismissOnEscape={false} does not close on Escape', () => {
    const onDismiss = vi.fn();
    render(
      <DialogShell labelledBy="test-title" dismissOnEscape={false} onDismiss={onDismiss}>
        <h2 id="test-title">Dialog</h2>
      </DialogShell>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('dismissOnOverlayClick={false} does not close on overlay click', () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <DialogShell labelledBy="test-title" dismissOnOverlayClick={false} onDismiss={onDismiss}>
        <h2 id="test-title">Dialog</h2>
      </DialogShell>,
    );
    const overlay = container.querySelector('.dialog-overlay')!;
    fireEvent.mouseDown(overlay, { target: overlay });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('dialog has aria-modal=true and aria-labelledby matching the id', () => {
    render(
      <DialogShell labelledBy="my-label">
        <h2 id="my-label">Title</h2>
      </DialogShell>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'my-label');
  });

  it('applies custom width via style', () => {
    render(
      <DialogShell labelledBy="test-title" width={600}>
        <h2 id="test-title">Wide</h2>
      </DialogShell>,
    );
    const panel = screen.getByRole('dialog');
    expect(panel).toHaveStyle({ width: '600px' });
  });
});
