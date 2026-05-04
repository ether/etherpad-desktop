import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AboutDialog } from '../../../src/renderer/dialogs/AboutDialog';
import { useShellStore, dialogActions } from '../../../src/renderer/state/store';

beforeEach(() => {
  useShellStore.setState(useShellStore.getInitialState());
  dialogActions.openDialog('about');
});

describe('AboutDialog', () => {
  it('shows the app name + Close dismisses', async () => {
    render(<AboutDialog />);
    expect(screen.getByRole('heading', { name: /etherpad desktop/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(useShellStore.getState().openDialog).toBeNull();
  });
});
