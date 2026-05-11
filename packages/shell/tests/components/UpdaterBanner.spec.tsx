import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpdaterBanner } from '../../src/components/UpdaterBanner';
import { useShellStore } from '../../src/state/store';

beforeEach(() => {
  useShellStore.setState(useShellStore.getInitialState());
  window.etherpadDesktop = {
    updater: { installAndRestart: vi.fn().mockResolvedValue({ ok: true }) },
  };
});

describe('UpdaterBanner', () => {
  it('renders nothing when state is idle', () => {
    useShellStore.setState({ updaterState: { kind: 'idle' } });
    const { container } = render(<UpdaterBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when checking', () => {
    useShellStore.setState({ updaterState: { kind: 'checking' } });
    const { container } = render(<UpdaterBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when unsupported', () => {
    useShellStore.setState({ updaterState: { kind: 'unsupported', reason: 'dev' } });
    const { container } = render(<UpdaterBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when update available (not yet downloaded)', () => {
    useShellStore.setState({ updaterState: { kind: 'available', version: '1.0.0' } });
    const { container } = render(<UpdaterBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows download progress when downloading', () => {
    useShellStore.setState({ updaterState: { kind: 'downloading', percent: 42 } });
    render(<UpdaterBanner />);
    expect(screen.getByRole('status')).toHaveTextContent('42%');
  });

  it('shows ready banner with version and restart button', async () => {
    useShellStore.setState({ updaterState: { kind: 'ready', version: '0.2.0' } });
    render(<UpdaterBanner />);
    expect(screen.getByRole('status')).toHaveTextContent('0.2.0');
    expect(screen.getByRole('button', { name: /restart/i })).toBeInTheDocument();
  });

  it('restart button calls ipc.updater.installAndRestart', async () => {
    useShellStore.setState({ updaterState: { kind: 'ready', version: '0.2.0' } });
    render(<UpdaterBanner />);
    await userEvent.click(screen.getByRole('button', { name: /restart/i }));
    expect(window.etherpadDesktop.updater.installAndRestart).toHaveBeenCalled();
  });

  it('shows error banner with alert role', () => {
    useShellStore.setState({ updaterState: { kind: 'error', message: 'gone' } });
    render(<UpdaterBanner />);
    expect(screen.getByRole('alert')).toHaveTextContent('gone');
  });
});
