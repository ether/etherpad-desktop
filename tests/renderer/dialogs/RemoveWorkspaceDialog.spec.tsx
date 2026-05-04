import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RemoveWorkspaceDialog } from '../../../src/renderer/dialogs/RemoveWorkspaceDialog';
import { useShellStore, dialogActions } from '../../../src/renderer/state/store';

beforeEach(() => {
  useShellStore.setState(useShellStore.getInitialState());
  useShellStore.setState({
    workspaces: [{ id: 'a', name: 'A', serverUrl: 'https://a', color: '#000', createdAt: 1 }],
    workspaceOrder: ['a'],
  });
  dialogActions.openDialog('removeWorkspace', { workspaceId: 'a' });
  // @ts-expect-error
  window.etherpadDesktop = {
    workspace: { remove: vi.fn().mockResolvedValue({ ok: true, value: { ok: true } }) },
    window: { setActiveWorkspace: vi.fn().mockResolvedValue({ ok: true }) },
  };
});

describe('RemoveWorkspaceDialog', () => {
  it('confirms and calls workspace.remove', async () => {
    render(<RemoveWorkspaceDialog />);
    await userEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(window.etherpadDesktop.workspace.remove).toHaveBeenCalledWith({ id: 'a' });
  });
});
