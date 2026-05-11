// tests/renderer/components/DialogShell.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DialogShell } from '../../src/components/DialogShell';
import { useShellStore, dialogActions } from '../../src/state/store';

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

  // REGRESSION: 2026-05-05 — without a focus trap, Tab/Shift+Tab inside an
  // open dialog could escape into the embedded WebContentsView (the pad) or
  // rail buttons behind the dialog. The trap keeps Tab cycling inside the
  // panel, which is a baseline ARIA APG dialog-modal requirement.
  it('Tab from the last focusable element wraps to the first', () => {
    render(
      <DialogShell labelledBy="test-title">
        <h2 id="test-title">Trap</h2>
        <input data-testid="first" />
        <button data-testid="middle">Mid</button>
        <button data-testid="last">Last</button>
      </DialogShell>,
    );
    const first = screen.getByTestId('first');
    const last = screen.getByTestId('last');
    last.focus();
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });

  it('Shift+Tab from the first focusable element wraps to the last', () => {
    render(
      <DialogShell labelledBy="test-title">
        <h2 id="test-title">Trap</h2>
        <input data-testid="first" />
        <button data-testid="last">Last</button>
      </DialogShell>,
    );
    const first = screen.getByTestId('first');
    const last = screen.getByTestId('last');
    first.focus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('Tab in the middle of the focusable list is NOT intercepted', () => {
    render(
      <DialogShell labelledBy="test-title">
        <h2 id="test-title">Trap</h2>
        <input data-testid="first" />
        <button data-testid="middle">Mid</button>
        <button data-testid="last">Last</button>
      </DialogShell>,
    );
    const middle = screen.getByTestId('middle');
    middle.focus();
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    window.dispatchEvent(ev);
    // The trap only preventDefault()s at the boundaries.
    expect(ev.defaultPrevented).toBe(false);
  });

  it('restores focus to the previously focused element on unmount', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = render(
      <DialogShell labelledBy="test-title">
        <h2 id="test-title">Restore</h2>
        <input data-testid="dialog-input" />
      </DialogShell>,
    );
    expect(document.activeElement).toBe(screen.getByTestId('dialog-input'));

    unmount();
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});
