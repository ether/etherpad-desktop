import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpAuthDialog } from '../../../src/renderer/dialogs/HttpAuthDialog';
import { useShellStore, dialogActions } from '../../../src/renderer/state/store';

beforeEach(() => {
  useShellStore.setState(useShellStore.getInitialState());
  dialogActions.openDialog('httpAuth', { requestId: 'r1', url: 'https://x' });
  // @ts-expect-error -- mock partial window.etherpadDesktop for test
  window.etherpadDesktop = {
    httpLogin: { respond: vi.fn().mockResolvedValue({ ok: true, value: { ok: true } }) },
  };
});

describe('HttpAuthDialog', () => {
  it('submits with credentials', async () => {
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
});
