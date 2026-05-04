// tests/renderer/tabs/TabStrip.spec.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabStrip } from '../../../src/renderer/tabs/TabStrip';
import { useShellStore } from '../../../src/renderer/state/store';

beforeEach(() => {
  useShellStore.setState(useShellStore.getInitialState());
  // @ts-expect-error mock
  window.etherpadDesktop = {
    tab: {
      close: vi.fn().mockResolvedValue({ ok: true }),
      focus: vi.fn().mockResolvedValue({ ok: true }),
    },
  };
});

describe('TabStrip', () => {
  it('renders one tab button per tab in active workspace', () => {
    useShellStore.setState({
      activeWorkspaceId: 'a',
      tabs: [
        { tabId: 't1', workspaceId: 'a', padName: 'standup', title: 'standup', state: 'loaded' },
        { tabId: 't2', workspaceId: 'a', padName: 'retro', title: 'retro', state: 'loaded' },
        { tabId: 't3', workspaceId: 'b', padName: 'other', title: 'other', state: 'loaded' },
      ],
    });
    render(<TabStrip />);
    expect(screen.getByText('standup')).toBeInTheDocument();
    expect(screen.getByText('retro')).toBeInTheDocument();
    expect(screen.queryByText('other')).not.toBeInTheDocument();
  });

  it('clicking a tab focuses it', async () => {
    useShellStore.setState({
      activeWorkspaceId: 'a',
      tabs: [{ tabId: 't1', workspaceId: 'a', padName: 'p', title: 'p', state: 'loaded' }],
    });
    render(<TabStrip />);
    await userEvent.click(screen.getByText('p'));
    expect(window.etherpadDesktop.tab.focus).toHaveBeenCalledWith({ tabId: 't1' });
  });

  it('clicking ✕ closes the tab', async () => {
    useShellStore.setState({
      activeWorkspaceId: 'a',
      tabs: [{ tabId: 't1', workspaceId: 'a', padName: 'p', title: 'p', state: 'loaded' }],
    });
    render(<TabStrip />);
    await userEvent.click(screen.getByRole('button', { name: /close tab/i }));
    expect(window.etherpadDesktop.tab.close).toHaveBeenCalledWith({ tabId: 't1' });
  });

  it('shows error indicator on tabs with state=error', () => {
    useShellStore.setState({
      activeWorkspaceId: 'a',
      tabs: [{ tabId: 't1', workspaceId: 'a', padName: 'p', title: 'p', state: 'error' }],
    });
    render(<TabStrip />);
    expect(screen.getByLabelText(/error/i)).toBeInTheDocument();
  });
});
