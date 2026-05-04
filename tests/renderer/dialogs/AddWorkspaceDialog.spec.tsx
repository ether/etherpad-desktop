// tests/renderer/dialogs/AddWorkspaceDialog.spec.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddWorkspaceDialog } from '../../../src/renderer/dialogs/AddWorkspaceDialog';
import { useShellStore, dialogActions } from '../../../src/renderer/state/store';

beforeEach(() => {
  useShellStore.setState(useShellStore.getInitialState());
  // @ts-expect-error mock
  window.etherpadDesktop = {
    workspace: {
      add: vi.fn().mockResolvedValue({
        ok: true,
        value: { id: 'a', name: 'A', serverUrl: 'https://a', color: '#000000', createdAt: 1 },
      }),
    },
  };
});

describe('AddWorkspaceDialog', () => {
  it('submits add() with the entered values', async () => {
    render(<AddWorkspaceDialog dismissable={false} />);
    await userEvent.type(screen.getByLabelText(/name/i), 'Acme');
    await userEvent.type(screen.getByLabelText(/etherpad url/i), 'https://pads.acme.test');
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(window.etherpadDesktop.workspace.add).toHaveBeenCalledWith({
      name: 'Acme',
      serverUrl: 'https://pads.acme.test',
      color: expect.stringMatching(/^#/),
    });
  });

  it('shows ServerUnreachableError text on probe failure', async () => {
    // @ts-expect-error mock override
    window.etherpadDesktop.workspace.add = vi.fn().mockResolvedValue({
      ok: false,
      error: { kind: 'ServerUnreachableError', message: 'gone' },
    });
    render(<AddWorkspaceDialog dismissable={false} />);
    await userEvent.type(screen.getByLabelText(/name/i), 'X');
    await userEvent.type(screen.getByLabelText(/etherpad url/i), 'https://x');
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(await screen.findByText(/could not reach/i)).toBeInTheDocument();
  });

  it('Cancel button dismisses when allowed', async () => {
    dialogActions.openDialog('addWorkspace');
    render(<AddWorkspaceDialog dismissable={true} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(useShellStore.getState().openDialog).toBeNull();
  });

  it('Cancel button is hidden when not dismissable (first run)', () => {
    render(<AddWorkspaceDialog dismissable={false} />);
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  });
});
