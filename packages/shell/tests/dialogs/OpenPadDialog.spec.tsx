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
    workspaces: [
      { id: 'a', name: 'Alpha', serverUrl: 'https://alpha', color: '#3366cc', createdAt: 1 },
      { id: 'b', name: 'Beta', serverUrl: 'https://beta', color: '#dc2626', createdAt: 2 },
    ],
    workspaceOrder: ['a', 'b'],
    padHistory: {
      a: [
        { workspaceId: 'a', padName: 'standup', lastOpenedAt: 1, pinned: false },
        { workspaceId: 'a', padName: 'standdown', lastOpenedAt: 0, pinned: false },
      ],
      b: [
        { workspaceId: 'b', padName: 'standby-cross-instance', lastOpenedAt: 5, pinned: false },
      ],
    },
  });
  window.etherpadDesktop = {
    tab: { open: vi.fn().mockResolvedValue({ ok: true, value: { tabId: 't' } }) },
    window: { setActiveWorkspace: vi.fn().mockResolvedValue({ ok: true }) },
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

  it('shows autocomplete suggestions across ALL workspaces, sorted by lastOpenedAt desc', async () => {
    render(<OpenPadDialog />);
    await userEvent.type(screen.getByLabelText(/pad name/i), 'stand');
    // Sorted desc by lastOpenedAt: standby-cross-instance(5) → standup(1) → standdown(0).
    // Each option label = "<padName><workspaceName>" because the rows
    // render the pad name then the workspace name in a muted suffix.
    const labels = screen.getAllByRole('option').map((o) => o.textContent);
    expect(labels).toEqual([
      'standby-cross-instanceBeta',
      'standupAlpha',
      'standdownAlpha',
    ]);
  });

  it('filters by workspace name too (typing "beta" surfaces Beta pads)', async () => {
    render(<OpenPadDialog />);
    await userEvent.type(screen.getByLabelText(/pad name/i), 'beta');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'standby-cross-instanceBeta',
    ]);
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

  it('clicking a same-workspace suggestion calls tab.open with that padName', async () => {
    render(<OpenPadDialog />);
    await userEvent.type(screen.getByLabelText(/pad name/i), 'standup');
    // Each option contains the pad-name button inside it; clicking the
    // button fires openSuggestion.
    const suggestion = screen.getAllByRole('option').find((o) => o.textContent?.includes('standupAlpha'))!;
    await userEvent.click(suggestion.querySelector('button')!);
    expect(window.etherpadDesktop.tab.open).toHaveBeenCalledWith({
      workspaceId: 'a',
      padName: 'standup',
      mode: 'open',
    });
    // Active workspace doesn't change (already on 'a').
    expect(window.etherpadDesktop.window.setActiveWorkspace).not.toHaveBeenCalled();
  });

  it('clicking a cross-workspace suggestion switches workspace AND opens the pad', async () => {
    render(<OpenPadDialog />);
    await userEvent.type(screen.getByLabelText(/pad name/i), 'standby');
    const suggestion = screen.getAllByRole('option').find((o) => o.textContent?.includes('Beta'))!;
    await userEvent.click(suggestion.querySelector('button')!);
    // Workspace switch fires BEFORE the tab.open, so the rail follows
    // the user's selection (cross-instance UX).
    expect(window.etherpadDesktop.window.setActiveWorkspace).toHaveBeenCalledWith({
      workspaceId: 'b',
    });
    expect(window.etherpadDesktop.tab.open).toHaveBeenCalledWith({
      workspaceId: 'b',
      padName: 'standby-cross-instance',
      mode: 'open',
    });
    expect(useShellStore.getState().activeWorkspaceId).toBe('b');
  });

  it('clicking autocomplete suggestion closes dialog', async () => {
    dialogActions.openDialog('openPad');
    render(<OpenPadDialog />);
    await userEvent.type(screen.getByLabelText(/pad name/i), 'standup');
    const suggestion = screen.getAllByRole('option').find((o) => o.textContent?.includes('standupAlpha'))!;
    await userEvent.click(suggestion.querySelector('button')!);
    await vi.waitFor(() => expect(useShellStore.getState().openDialog).toBeNull());
  });

  it('Enter on the input opens the first suggestion (Spotlight convention)', async () => {
    render(<OpenPadDialog />);
    await userEvent.type(screen.getByLabelText(/pad name/i), 'stand{Enter}');
    // First suggestion sorted by lastOpenedAt desc is the Beta pad.
    expect(window.etherpadDesktop.tab.open).toHaveBeenCalledWith({
      workspaceId: 'b',
      padName: 'standby-cross-instance',
      mode: 'open',
    });
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
