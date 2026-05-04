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
});
