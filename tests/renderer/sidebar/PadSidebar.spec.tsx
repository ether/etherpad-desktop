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
    // Only 50 recent items should be rendered (each has a pad-open button with the pad name)
    const buttons = screen.getAllByRole('button').filter((b) => b.textContent?.startsWith('pad'));
    expect(buttons.length).toBe(50);
  });

  it('shows ☆ on recent pads, ★ on pinned pads', () => {
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
    expect(screen.getByRole('button', { name: /unpin standup/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^pin retro/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking ☆ on a recent pad calls padHistory.pin and does not open the pad', async () => {
    useShellStore.setState({
      activeWorkspaceId: 'a',
      padHistory: { a: [{ workspaceId: 'a', padName: 'retro', lastOpenedAt: 1, pinned: false }] },
    });
    render(<PadSidebar />);
    await userEvent.click(screen.getByRole('button', { name: /^pin retro/i }));
    expect(window.etherpadDesktop.padHistory.pin).toHaveBeenCalledWith({ workspaceId: 'a', padName: 'retro' });
    expect(window.etherpadDesktop.tab.open).not.toHaveBeenCalled();
  });

  it('clicking ★ on a pinned pad calls padHistory.unpin and does not open', async () => {
    useShellStore.setState({
      activeWorkspaceId: 'a',
      padHistory: { a: [{ workspaceId: 'a', padName: 'standup', lastOpenedAt: 2, pinned: true }] },
    });
    render(<PadSidebar />);
    await userEvent.click(screen.getByRole('button', { name: /unpin standup/i }));
    expect(window.etherpadDesktop.padHistory.unpin).toHaveBeenCalledWith({ workspaceId: 'a', padName: 'standup' });
    expect(window.etherpadDesktop.tab.open).not.toHaveBeenCalled();
  });

  it('typing in the filter narrows the visible pad list', async () => {
    useShellStore.setState({
      activeWorkspaceId: 'a',
      padHistory: {
        a: [
          { workspaceId: 'a', padName: 'standup', lastOpenedAt: 2, pinned: false },
          { workspaceId: 'a', padName: 'retro', lastOpenedAt: 1, pinned: false },
        ],
      },
    });
    render(<PadSidebar />);
    expect(screen.getByText('standup')).toBeInTheDocument();
    expect(screen.getByText('retro')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: /filter pads/i }), 'stand');
    expect(screen.getByText('standup')).toBeInTheDocument();
    expect(screen.queryByText('retro')).not.toBeInTheDocument();
  });

  it('shows "No pads match" when filter has no results', async () => {
    useShellStore.setState({
      activeWorkspaceId: 'a',
      padHistory: { a: [{ workspaceId: 'a', padName: 'standup', lastOpenedAt: 1, pinned: false }] },
    });
    render(<PadSidebar />);
    await userEvent.type(screen.getByRole('textbox', { name: /filter pads/i }), 'xyznomatch');
    expect(screen.getByText(/no pads match/i)).toBeInTheDocument();
    expect(screen.queryByText('standup')).not.toBeInTheDocument();
  });

  it('clearing the filter restores all pads', async () => {
    useShellStore.setState({
      activeWorkspaceId: 'a',
      padHistory: {
        a: [
          { workspaceId: 'a', padName: 'standup', lastOpenedAt: 2, pinned: false },
          { workspaceId: 'a', padName: 'retro', lastOpenedAt: 1, pinned: false },
        ],
      },
    });
    render(<PadSidebar />);
    const input = screen.getByRole('textbox', { name: /filter pads/i });
    await userEvent.type(input, 'stand');
    expect(screen.queryByText('retro')).not.toBeInTheDocument();
    await userEvent.clear(input);
    expect(screen.getByText('retro')).toBeInTheDocument();
  });

  it('+New Pad button stays visible regardless of filter', async () => {
    useShellStore.setState({ activeWorkspaceId: 'a', padHistory: { a: [] } });
    render(<PadSidebar />);
    await userEvent.type(screen.getByRole('textbox', { name: /filter pads/i }), 'anything');
    expect(screen.getByRole('button', { name: /new pad/i })).toBeInTheDocument();
  });

  it('filter matches by title as well as padName', async () => {
    useShellStore.setState({
      activeWorkspaceId: 'a',
      padHistory: {
        a: [
          { workspaceId: 'a', padName: 'pad-abc', title: 'Weekly Standup', lastOpenedAt: 2, pinned: false },
          { workspaceId: 'a', padName: 'retro', lastOpenedAt: 1, pinned: false },
        ],
      },
    });
    render(<PadSidebar />);
    await userEvent.type(screen.getByRole('textbox', { name: /filter pads/i }), 'weekly');
    expect(screen.getByText('Weekly Standup')).toBeInTheDocument();
    expect(screen.queryByText('retro')).not.toBeInTheDocument();
  });

  it('filter is case-insensitive', async () => {
    useShellStore.setState({
      activeWorkspaceId: 'a',
      padHistory: {
        a: [
          { workspaceId: 'a', padName: 'StandUp', lastOpenedAt: 1, pinned: false },
        ],
      },
    });
    render(<PadSidebar />);
    await userEvent.type(screen.getByRole('textbox', { name: /filter pads/i }), 'standup');
    expect(screen.getByText('StandUp')).toBeInTheDocument();
  });
});
