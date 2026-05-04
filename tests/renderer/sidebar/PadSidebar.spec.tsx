// tests/renderer/sidebar/PadSidebar.spec.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PadSidebar } from '../../../src/renderer/sidebar/PadSidebar';
import { useShellStore } from '../../../src/renderer/state/store';

beforeEach(() => {
  useShellStore.setState(useShellStore.getInitialState());
  // @ts-expect-error mock
  window.etherpadDesktop = {
    tab: { open: vi.fn().mockResolvedValue({ ok: true, value: { tabId: 't' } }) },
    padHistory: {
      pin: vi.fn().mockResolvedValue({ ok: true }),
      unpin: vi.fn().mockResolvedValue({ ok: true }),
    },
  };
});

describe('PadSidebar', () => {
  it('shows separated Pinned and Recent sections from pad history', () => {
    useShellStore.setState({
      activeWorkspaceId: 'a',
      padHistory: {
        a: [
          { workspaceId: 'a', padName: 'standup', lastOpenedAt: 2, pinned: true },
          { workspaceId: 'a', padName: 'retro', lastOpenedAt: 1, pinned: false },
        ],
      },
    });
    render(<PadSidebar />);
    expect(screen.getByText(/pinned/i)).toBeInTheDocument();
    expect(screen.getByText(/recent/i)).toBeInTheDocument();
    expect(screen.getByText('standup')).toBeInTheDocument();
    expect(screen.getByText('retro')).toBeInTheDocument();
  });

  it('clicking a pad calls tab.open', async () => {
    useShellStore.setState({
      activeWorkspaceId: 'a',
      padHistory: {
        a: [{ workspaceId: 'a', padName: 'standup', lastOpenedAt: 1, pinned: false }],
      },
    });
    render(<PadSidebar />);
    await userEvent.click(screen.getByText('standup'));
    expect(window.etherpadDesktop.tab.open).toHaveBeenCalledWith({
      workspaceId: 'a',
      padName: 'standup',
      mode: 'open',
    });
  });

  it('+ New Pad opens OpenPadDialog', async () => {
    useShellStore.setState({ activeWorkspaceId: 'a' });
    render(<PadSidebar />);
    await userEvent.click(screen.getByRole('button', { name: /new pad/i }));
    expect(useShellStore.getState().openDialog).toBe('openPad');
  });

  it('shows nothing useful when no active workspace', () => {
    render(<PadSidebar />);
    expect(screen.queryByRole('button', { name: /new pad/i })).not.toBeInTheDocument();
  });

  it('empty history: no Pinned section, Recent section is empty', () => {
    useShellStore.setState({
      activeWorkspaceId: 'a',
      padHistory: { a: [] },
    });
    render(<PadSidebar />);
    // Pinned section only renders if pinned.length > 0
    expect(screen.queryByText(/pinned/i)).not.toBeInTheDocument();
    // Recent section always renders (even when empty)
    expect(screen.getByText(/recent/i)).toBeInTheDocument();
  });

  it('clicking a pinned pad calls tab.open', async () => {
    useShellStore.setState({
      activeWorkspaceId: 'a',
      padHistory: {
        a: [{ workspaceId: 'a', padName: 'standup', lastOpenedAt: 1, pinned: true }],
      },
    });
    render(<PadSidebar />);
    await userEvent.click(screen.getByText('standup'));
    expect(window.etherpadDesktop.tab.open).toHaveBeenCalledWith({
      workspaceId: 'a',
      padName: 'standup',
      mode: 'open',
    });
  });

  it('uses title over padName when available', () => {
    useShellStore.setState({
      activeWorkspaceId: 'a',
      padHistory: {
        a: [{ workspaceId: 'a', padName: 'mypad', title: 'My Beautiful Pad', lastOpenedAt: 1, pinned: false }],
      },
    });
    render(<PadSidebar />);
    expect(screen.getByText('My Beautiful Pad')).toBeInTheDocument();
    expect(screen.queryByText('mypad')).not.toBeInTheDocument();
  });

  it('caps recent list at 50 entries', () => {
    const entries = Array.from({ length: 60 }, (_, i) => ({
      workspaceId: 'a',
      padName: `pad${i}`,
      lastOpenedAt: i,
      pinned: false,
    }));
    useShellStore.setState({ activeWorkspaceId: 'a', padHistory: { a: entries } });
    render(<PadSidebar />);
    // Only 50 recent items should be rendered
    const buttons = screen.getAllByRole('button').filter((b) => b.textContent?.startsWith('pad'));
    expect(buttons.length).toBe(50);
  });
});
