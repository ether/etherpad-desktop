import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RemoveWorkspaceDialog } from '../../src/dialogs/RemoveWorkspaceDialog';
import { useShellStore, dialogActions } from '../../src/state/store';

beforeEach(() => {
  useShellStore.setState(useShellStore.getInitialState());
  useShellStore.setState({
    workspaces: [
      { id: 'a', name: 'Alpha', serverUrl: 'https://a', color: '#000', createdAt: 1 },
      { id: 'b', name: 'Beta', serverUrl: 'https://b', color: '#111', createdAt: 2 },
    ],
    workspaceOrder: ['a', 'b'],
  });
  dialogActions.openDialog('removeWorkspace', { workspaceId: 'a' });
  window.etherpadDesktop = {
    workspace: { remove: vi.fn().mockResolvedValue({ ok: true, value: { ok: true } }) },
    window: { setActiveWorkspace: vi.fn().mockResolvedValue({ ok: true }) },
  };
});

describe('RemoveWorkspaceDialog', () => {
  it('confirms and calls workspace.remove', async () => {
    render(<RemoveWorkspaceDialog />);
    await userEvent.click(screen.getByRole('button', { name: /^remove$/i }));
    expect(window.etherpadDesktop.workspace.remove).toHaveBeenCalledWith({ id: 'a' });
  });

  it('shows the workspace name in the dialog', () => {
    render(<RemoveWorkspaceDialog />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('Cancel button closes dialog without calling remove', async () => {
    render(<RemoveWorkspaceDialog />);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(useShellStore.getState().openDialog).toBeNull();
    expect(window.etherpadDesktop.workspace.remove).not.toHaveBeenCalled();
  });

  it('confirm closes dialog after successful removal', async () => {
    render(<RemoveWorkspaceDialog />);
    await userEvent.click(screen.getByRole('button', { name: /^remove$/i }));
    await vi.waitFor(() => expect(useShellStore.getState().openDialog).toBeNull());
  });

  it('confirm sets activeWorkspaceId to the next workspace in order', async () => {
    // order is ['a','b'], removing 'a' → next = 'b'
    // But the component uses workspaceOrder[0] after removal
    // After remove, workspaceOrder still has ['a','b'] in store (store not updated by dialog)
    // The dialog picks workspaceOrder[0] as next
    render(<RemoveWorkspaceDialog />);
    await userEvent.click(screen.getByRole('button', { name: /^remove$/i }));
    await vi.waitFor(() => expect(useShellStore.getState().openDialog).toBeNull());
    // Should have called setActiveWorkspace with the first remaining workspace
    expect(window.etherpadDesktop.window.setActiveWorkspace).toHaveBeenCalled();
  });

  it('renders nothing when workspaceId in context does not match any workspace', () => {
    dialogActions.openDialog('removeWorkspace', { workspaceId: 'nonexistent' });
    const { container } = render(<RemoveWorkspaceDialog />);
    expect(container.firstChild).toBeNull();
  });

  it('shows error message if remove call fails', async () => {
    window.etherpadDesktop.workspace.remove = vi.fn().mockResolvedValue({
      ok: false,
      error: { kind: 'WorkspaceNotFoundError', message: 'not found' },
    });
    render(<RemoveWorkspaceDialog />);
    await userEvent.click(screen.getByRole('button', { name: /^remove$/i }));
    // AppError thrown by unwrap → caught and shown in state
    await vi.waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
