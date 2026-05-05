// tests/renderer/rail/WorkspaceRail.spec.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkspaceRail } from '../../../src/renderer/rail/WorkspaceRail';
import { useShellStore } from '../../../src/renderer/state/store';

let setActiveWorkspaceMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  useShellStore.setState(useShellStore.getInitialState());
  setActiveWorkspaceMock = vi.fn().mockResolvedValue({ ok: true });
  // @ts-expect-error mock
  window.etherpadDesktop = {
    window: { setActiveWorkspace: setActiveWorkspaceMock },
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

  it('clicking a workspace calls ipc.window.setActiveWorkspace with the id', async () => {
    useShellStore.setState({
      workspaces: [{ id: 'a', name: 'Alpha', serverUrl: 'https://a', color: '#000', createdAt: 1 }],
      workspaceOrder: ['a'],
    });
    render(<WorkspaceRail />);
    await userEvent.click(screen.getByRole('button', { name: /Alpha/ }));
    expect(setActiveWorkspaceMock).toHaveBeenCalledWith({ workspaceId: 'a' });
  });

  it('+ button opens AddWorkspaceDialog', async () => {
    render(<WorkspaceRail />);
    await userEvent.click(screen.getByRole('button', { name: /add workspace/i }));
    expect(useShellStore.getState().openDialog).toBe('addWorkspace');
  });

  it('settings cog button opens SettingsDialog', async () => {
    render(<WorkspaceRail />);
    await userEvent.click(screen.getByRole('button', { name: /^settings$/i }));
    expect(useShellStore.getState().openDialog).toBe('settings');
  });

  it('clicking the search button opens the quick switcher', async () => {
    render(<WorkspaceRail />);
    await userEvent.click(screen.getByRole('button', { name: /search workspaces and pads/i }));
    expect(useShellStore.getState().openDialog).toBe('quickSwitcher');
  });

  it('+ add button has a title attribute for tooltip', () => {
    render(<WorkspaceRail />);
    expect(screen.getByRole('button', { name: /add workspace/i })).toHaveAttribute('title');
  });

  it('settings cog button has a title attribute for tooltip', () => {
    render(<WorkspaceRail />);
    expect(screen.getByRole('button', { name: /^settings$/i })).toHaveAttribute('title');
  });

  it('search button has a title attribute for tooltip', () => {
    render(<WorkspaceRail />);
    expect(screen.getByRole('button', { name: /search workspaces and pads/i })).toHaveAttribute('title');
  });

  it('active workspace button has a visual ring (boxShadow)', () => {
    useShellStore.setState({
      workspaces: [
        { id: 'a', name: 'Alpha', serverUrl: 'https://a', color: '#000', createdAt: 1 },
        { id: 'b', name: 'Beta', serverUrl: 'https://b', color: '#111', createdAt: 2 },
      ],
      workspaceOrder: ['a', 'b'],
      activeWorkspaceId: 'a',
    });
    render(<WorkspaceRail />);
    const activeBtn = screen.getByRole('button', { name: /open workspace alpha/i });
    const inactiveBtn = screen.getByRole('button', { name: /open workspace beta/i });
    // Active: has a ring shadow; inactive: no shadow
    expect(activeBtn).toHaveStyle({ boxShadow: '0 0 0 2px var(--accent)' });
    expect(inactiveBtn).toHaveStyle({ boxShadow: 'none' });
  });

  it('workspace buttons render first two uppercase letters of the name', () => {
    useShellStore.setState({
      workspaces: [{ id: 'a', name: 'hello', serverUrl: 'https://a', color: '#000', createdAt: 1 }],
      workspaceOrder: ['a'],
    });
    render(<WorkspaceRail />);
    expect(screen.getByRole('button', { name: /open workspace hello/i })).toHaveTextContent('HE');
  });
});
