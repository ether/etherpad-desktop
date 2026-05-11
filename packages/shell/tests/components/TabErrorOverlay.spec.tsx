// tests/renderer/components/TabErrorOverlay.spec.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabErrorOverlay } from '../../src/components/TabErrorOverlay';
import { useShellStore } from '../../src/state/store';

beforeEach(() => {
  useShellStore.setState(useShellStore.getInitialState());
  window.etherpadDesktop = {
    tab: {
      reload: vi.fn().mockResolvedValue({ ok: true }),
      close: vi.fn().mockResolvedValue({ ok: true }),
    },
  };
});

const WS = { id: 'ws1', name: 'Test', serverUrl: 'https://test.example.com', color: '#000', createdAt: 1 };
const TAB_LOADED = { tabId: 't1', workspaceId: 'ws1', padName: 'p', title: 'p', state: 'loaded' as const };
const TAB_ERROR = { tabId: 't1', workspaceId: 'ws1', padName: 'p', title: 'p', state: 'error' as const, errorMessage: 'HTTP 502' };
const TAB_CRASHED = { tabId: 't1', workspaceId: 'ws1', padName: 'p', title: 'p', state: 'crashed' as const };

describe('TabErrorOverlay', () => {
  it('renders nothing when active tab is in loaded state', () => {
    useShellStore.setState({
      activeWorkspaceId: 'ws1',
      workspaces: [WS],
      tabs: [TAB_LOADED],
      activeTabId: 't1',
    });
    const { container } = render(<TabErrorOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when there is no active tab', () => {
    useShellStore.setState({
      activeWorkspaceId: 'ws1',
      workspaces: [WS],
      tabs: [],
      activeTabId: null,
    });
    const { container } = render(<TabErrorOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it('shows errorMessage when tab is in error state', () => {
    useShellStore.setState({
      activeWorkspaceId: 'ws1',
      workspaces: [WS],
      tabs: [TAB_ERROR],
      activeTabId: 't1',
    });
    render(<TabErrorOverlay />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('HTTP 502')).toBeInTheDocument();
  });

  it('shows server URL in message when tab has no errorMessage', () => {
    useShellStore.setState({
      activeWorkspaceId: 'ws1',
      workspaces: [WS],
      tabs: [{ tabId: 't1', workspaceId: 'ws1', padName: 'p', title: 'p', state: 'error' as const }],
      activeTabId: 't1',
    });
    render(<TabErrorOverlay />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    // Falls back to workspace serverUrl in the message
    expect(screen.getByText(/test\.example\.com/)).toBeInTheDocument();
  });

  it('shows crashed message when tab is in crashed state', () => {
    useShellStore.setState({
      activeWorkspaceId: 'ws1',
      workspaces: [WS],
      tabs: [TAB_CRASHED],
      activeTabId: 't1',
    });
    render(<TabErrorOverlay />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/crashed/i)).toBeInTheDocument();
  });

  it('Retry button calls ipc.tab.reload with tabId (error state)', async () => {
    useShellStore.setState({
      activeWorkspaceId: 'ws1',
      workspaces: [WS],
      tabs: [TAB_ERROR],
      activeTabId: 't1',
    });
    render(<TabErrorOverlay />);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(window.etherpadDesktop.tab.reload).toHaveBeenCalledWith({ tabId: 't1' });
  });

  it('Reload button calls ipc.tab.reload with tabId (crashed state)', async () => {
    useShellStore.setState({
      activeWorkspaceId: 'ws1',
      workspaces: [WS],
      tabs: [TAB_CRASHED],
      activeTabId: 't1',
    });
    render(<TabErrorOverlay />);
    await userEvent.click(screen.getByRole('button', { name: /reload/i }));
    expect(window.etherpadDesktop.tab.reload).toHaveBeenCalledWith({ tabId: 't1' });
  });

  it('Close pad button calls ipc.tab.close with tabId (error state)', async () => {
    useShellStore.setState({
      activeWorkspaceId: 'ws1',
      workspaces: [WS],
      tabs: [TAB_ERROR],
      activeTabId: 't1',
    });
    render(<TabErrorOverlay />);
    await userEvent.click(screen.getByRole('button', { name: /close pad/i }));
    expect(window.etherpadDesktop.tab.close).toHaveBeenCalledWith({ tabId: 't1' });
  });

  it('Close pad button calls ipc.tab.close with tabId (crashed state)', async () => {
    useShellStore.setState({
      activeWorkspaceId: 'ws1',
      workspaces: [WS],
      tabs: [TAB_CRASHED],
      activeTabId: 't1',
    });
    render(<TabErrorOverlay />);
    await userEvent.click(screen.getByRole('button', { name: /close pad/i }));
    expect(window.etherpadDesktop.tab.close).toHaveBeenCalledWith({ tabId: 't1' });
  });

  it('error state shows Retry (not Reload) button label', () => {
    useShellStore.setState({
      activeWorkspaceId: 'ws1',
      workspaces: [WS],
      tabs: [TAB_ERROR],
      activeTabId: 't1',
    });
    render(<TabErrorOverlay />);
    expect(screen.getByRole('button', { name: /^retry$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^reload$/i })).not.toBeInTheDocument();
  });

  it('crashed state shows Reload (not Retry) button label', () => {
    useShellStore.setState({
      activeWorkspaceId: 'ws1',
      workspaces: [WS],
      tabs: [TAB_CRASHED],
      activeTabId: 't1',
    });
    render(<TabErrorOverlay />);
    expect(screen.getByRole('button', { name: /^reload$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^retry$/i })).not.toBeInTheDocument();
  });
});
