import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpAuthDialog } from '../../../src/renderer/dialogs/HttpAuthDialog';
import { useShellStore, dialogActions } from '../../../src/renderer/state/store';

beforeEach(() => {
  useShellStore.setState(useShellStore.getInitialState());
  dialogActions.openDialog('httpAuth', { requestId: 'r1', url: 'https://x.example.com' });
  // @ts-expect-error -- mock partial window.etherpadDesktop for test
  window.etherpadDesktop = {
    httpLogin: { respond: vi.fn().mockResolvedValue({ ok: true, value: { ok: true } }) },
  };
});

describe('HttpAuthDialog', () => {
  it('submits with credentials (cancel=false)', async () => {
    render(<HttpAuthDialog />);
    await userEvent.type(screen.getByLabelText(/username/i), 'alice');
    await userEvent.type(screen.getByLabelText(/password/i), 'p');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(window.etherpadDesktop.httpLogin.respond).toHaveBeenCalledWith({
      requestId: 'r1',
      cancel: false,
      username: 'alice',
      password: 'p',
    });
  });

  it('Cancel button calls respond with cancel=true (no credentials)', async () => {
    render(<HttpAuthDialog />);
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(window.etherpadDesktop.httpLogin.respond).toHaveBeenCalledWith({
      requestId: 'r1',
      cancel: true,
    });
  });

  it('Cancel button closes dialog', async () => {
    render(<HttpAuthDialog />);
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    await vi.waitFor(() => expect(useShellStore.getState().openDialog).toBeNull());
  });

  it('Sign In button is disabled when username is empty', () => {
    render(<HttpAuthDialog />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
  });

  it('Sign In button is enabled after typing a username', async () => {
    render(<HttpAuthDialog />);
    await userEvent.type(screen.getByLabelText(/username/i), 'bob');
    expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled();
  });

  it('shows the URL from dialog context', () => {
    render(<HttpAuthDialog />);
    expect(screen.getByText(/x\.example\.com/)).toBeInTheDocument();
  });

  it('Sign In closes dialog on success', async () => {
    render(<HttpAuthDialog />);
    await userEvent.type(screen.getByLabelText(/username/i), 'alice');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await vi.waitFor(() => expect(useShellStore.getState().openDialog).toBeNull());
  });
});
