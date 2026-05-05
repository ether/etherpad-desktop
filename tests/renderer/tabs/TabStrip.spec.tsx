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
    await userEvent.click(screen.getByRole('button', { name: /close pad/i }));
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

  it('shows error indicator on tabs with state=crashed', () => {
    useShellStore.setState({
      activeWorkspaceId: 'a',
      tabs: [{ tabId: 't1', workspaceId: 'a', padName: 'p', title: 'p', state: 'crashed' }],
    });
    render(<TabStrip />);
    expect(screen.getByLabelText(/error/i)).toBeInTheDocument();
  });

  it('active tab has aria-selected=true, inactive tab has aria-selected=false', () => {
    useShellStore.setState({
      activeWorkspaceId: 'a',
      tabs: [
        { tabId: 't1', workspaceId: 'a', padName: 'p1', title: 'Pad One', state: 'loaded' },
        { tabId: 't2', workspaceId: 'a', padName: 'p2', title: 'Pad Two', state: 'loaded' },
      ],
      activeTabId: 't1',
    });
    render(<TabStrip />);
    const tabs = screen.getAllByRole('tab');
    const activeTab = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
    const inactiveTab = tabs.find((t) => t.getAttribute('aria-selected') === 'false');
    expect(activeTab).toBeDefined();
    expect(inactiveTab).toBeDefined();
    // Verify the right one is active
    expect(activeTab).toContainElement(screen.getByText('Pad One'));
  });

  it('renders no tabs when there is no active workspace', () => {
    useShellStore.setState({
      activeWorkspaceId: null,
      tabs: [{ tabId: 't1', workspaceId: 'a', padName: 'p', title: 'p', state: 'loaded' }],
    });
    render(<TabStrip />);
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('only shows tabs belonging to the active workspace', () => {
    useShellStore.setState({
      activeWorkspaceId: 'a',
      tabs: [
        { tabId: 't1', workspaceId: 'a', padName: 'pa', title: 'WsA Tab', state: 'loaded' },
        { tabId: 't2', workspaceId: 'b', padName: 'pb', title: 'WsB Tab', state: 'loaded' },
      ],
    });
    render(<TabStrip />);
    expect(screen.getByText('WsA Tab')).toBeInTheDocument();
    expect(screen.queryByText('WsB Tab')).not.toBeInTheDocument();
  });

  it('no error indicator on tabs with state=loaded', () => {
    useShellStore.setState({
      activeWorkspaceId: 'a',
      tabs: [{ tabId: 't1', workspaceId: 'a', padName: 'p', title: 'p', state: 'loaded' }],
    });
    render(<TabStrip />);
    expect(screen.queryByLabelText(/error/i)).not.toBeInTheDocument();
  });
});
