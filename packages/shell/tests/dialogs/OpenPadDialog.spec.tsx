// tests/renderer/dialogs/OpenPadDialog.spec.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OpenPadDialog } from '../../src/dialogs/OpenPadDialog';
import { useShellStore, dialogActions } from '../../src/state/store';

beforeEach(() => {
  useShellStore.setState(useShellStore.getInitialState());
  useShellStore.setState({
    activeWorkspaceId: 'a',
    padHistory: {
      a: [
        { workspaceId: 'a', padName: 'standup', lastOpenedAt: 1, pinned: false },
        { workspaceId: 'a', padName: 'standdown', lastOpenedAt: 0, pinned: false },
      ],
    },
  });
  window.etherpadDesktop = {
    tab: { open: vi.fn().mockResolvedValue({ ok: true, value: { tabId: 't' } }) },
  };
});

describe('OpenPadDialog', () => {
  it('submits tab.open with the entered name', async () => {
    dialogActions.openDialog('openPad');
    render(<OpenPadDialog />);
    await userEvent.type(screen.getByLabelText(/pad name/i), 'standup');
    await userEvent.click(screen.getByRole('button', { name: /open/i }));
    expect(window.etherpadDesktop.tab.open).toHaveBeenCalledWith({
      workspaceId: 'a',
      padName: 'standup',
      mode: 'open',
    });
  });

  it('shows autocomplete suggestions matching the input', async () => {
    render(<OpenPadDialog />);
    await userEvent.type(screen.getByLabelText(/pad name/i), 'stand');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['standup', 'standdown']);
  });

  it('no "Create new" checkbox — Etherpad auto-creates on open and the checkbox was dead UI', () => {
    render(<OpenPadDialog />);
    expect(screen.queryByRole('checkbox', { name: /create new/i })).not.toBeInTheDocument();
  });

  it('Open button is disabled when pad name is empty', () => {
    render(<OpenPadDialog />);
    expect(screen.getByRole('button', { name: /^open$/i })).toBeDisabled();
  });

  it('Open button is enabled when pad name is filled', async () => {
    render(<OpenPadDialog />);
    await userEvent.type(screen.getByLabelText(/pad name/i), 'moo');
    expect(screen.getByRole('button', { name: /^open$/i })).not.toBeDisabled();
  });

  it('Cancel button closes the dialog', async () => {
    dialogActions.openDialog('openPad');
    render(<OpenPadDialog />);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(useShellStore.getState().openDialog).toBeNull();
  });

  it('clicking an autocomplete suggestion calls tab.open with that padName', async () => {
    render(<OpenPadDialog />);
    await userEvent.type(screen.getByLabelText(/pad name/i), 'stand');
    const suggestion = screen.getByRole('option', { name: 'standup' });
    await userEvent.click(suggestion.querySelector('button')!);
    expect(window.etherpadDesktop.tab.open).toHaveBeenCalledWith({
      workspaceId: 'a',
      padName: 'standup',
      mode: 'open',
    });
  });

  it('clicking autocomplete suggestion closes dialog', async () => {
    dialogActions.openDialog('openPad');
    render(<OpenPadDialog />);
    await userEvent.type(screen.getByLabelText(/pad name/i), 'stand');
    const suggestion = screen.getByRole('option', { name: 'standup' });
    await userEvent.click(suggestion.querySelector('button')!);
    await vi.waitFor(() => expect(useShellStore.getState().openDialog).toBeNull());
  });

  it('successful submit closes the dialog', async () => {
    dialogActions.openDialog('openPad');
    render(<OpenPadDialog />);
    await userEvent.type(screen.getByLabelText(/pad name/i), 'freshpad');
    await userEvent.click(screen.getByRole('button', { name: /^open$/i }));
    await vi.waitFor(() => expect(useShellStore.getState().openDialog).toBeNull());
  });

  it('does not call tab.open when pad name is empty and submit is clicked (guarded)', async () => {
    // Submit button is disabled; click does nothing
    render(<OpenPadDialog />);
    const openBtn = screen.getByRole('button', { name: /^open$/i });
    expect(openBtn).toBeDisabled();
    // Verify IPC not called
    expect(window.etherpadDesktop.tab.open).not.toHaveBeenCalled();
  });

  it('pressing Escape closes the dialog', () => {
    dialogActions.openDialog('openPad');
    const { baseElement } = render(<OpenPadDialog />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    baseElement.ownerDocument.defaultView!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    expect(useShellStore.getState().openDialog).toBeNull();
  });

  it('clicking the overlay closes the dialog', () => {
    dialogActions.openDialog('openPad');
    const { container } = render(<OpenPadDialog />);
    const overlay = container.querySelector('.dialog-overlay')!;
    fireEvent.mouseDown(overlay, { target: overlay });
    expect(useShellStore.getState().openDialog).toBeNull();
  });
});
