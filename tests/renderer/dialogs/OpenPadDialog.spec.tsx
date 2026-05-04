// tests/renderer/dialogs/OpenPadDialog.spec.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OpenPadDialog } from '../../../src/renderer/dialogs/OpenPadDialog';
import { useShellStore, dialogActions } from '../../../src/renderer/state/store';

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
  // @ts-expect-error
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

  it('+ create flips mode to "create"', async () => {
    render(<OpenPadDialog />);
    await userEvent.click(screen.getByRole('checkbox', { name: /create new/i }));
    await userEvent.type(screen.getByLabelText(/pad name/i), 'fresh');
    await userEvent.click(screen.getByRole('button', { name: /open/i }));
    expect(window.etherpadDesktop.tab.open).toHaveBeenCalledWith({
      workspaceId: 'a',
      padName: 'fresh',
      mode: 'create',
    });
  });
});
