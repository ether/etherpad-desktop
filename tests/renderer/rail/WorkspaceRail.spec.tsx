// tests/renderer/rail/WorkspaceRail.spec.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkspaceRail } from '../../../src/renderer/rail/WorkspaceRail';
import { useShellStore, dialogActions } from '../../../src/renderer/state/store';

beforeEach(() => {
  useShellStore.setState(useShellStore.getInitialState());
  // @ts-expect-error mock
  window.etherpadDesktop = {
    window: { setActiveWorkspace: vi.fn().mockResolvedValue({ ok: true }) },
  };
});

describe('WorkspaceRail', () => {
  it('renders one button per workspace, in order', () => {
    useShellStore.setState({
      workspaces: [
        { id: 'a', name: 'Alpha', serverUrl: 'https://a', color: '#000000', createdAt: 1 },
        { id: 'b', name: 'Beta', serverUrl: 'https://b', color: '#111111', createdAt: 2 },
      ],
      workspaceOrder: ['b', 'a'],
    });
    render(<WorkspaceRail />);
    const ids = screen.getAllByRole('button', { name: /open workspace/i }).map((b) => b.getAttribute('data-ws-id'));
    expect(ids).toEqual(['b', 'a']);
  });

  it('clicking a workspace calls setActiveWorkspace and updates store', async () => {
    useShellStore.setState({
      workspaces: [{ id: 'a', name: 'Alpha', serverUrl: 'https://a', color: '#000', createdAt: 1 }],
      workspaceOrder: ['a'],
    });
    render(<WorkspaceRail />);
    await userEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    expect(useShellStore.getState().activeWorkspaceId).toBe('a');
  });

  it('+ button opens AddWorkspaceDialog', async () => {
    render(<WorkspaceRail />);
    await userEvent.click(screen.getByRole('button', { name: /add workspace/i }));
    expect(useShellStore.getState().openDialog).toBe('addWorkspace');
  });
});
