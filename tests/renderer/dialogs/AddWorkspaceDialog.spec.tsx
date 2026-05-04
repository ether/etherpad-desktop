// tests/renderer/dialogs/AddWorkspaceDialog.spec.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddWorkspaceDialog } from '../../../src/renderer/dialogs/AddWorkspaceDialog';
import { useShellStore, dialogActions } from '../../../src/renderer/state/store';

beforeEach(() => {
  useShellStore.setState(useShellStore.getInitialState());
  // @ts-expect-error mock
  window.etherpadDesktop = {
    workspace: {
      add: vi.fn().mockResolvedValue({
        ok: true,
        value: { id: 'a', name: 'A', serverUrl: 'https://a', color: '#000000', createdAt: 1 },
      }),
    },
    window: {
      setActiveWorkspace: vi.fn().mockResolvedValue({ ok: true }),
    },
  };
});

describe('AddWorkspaceDialog', () => {
  it('submits add() with the entered values', async () => {
    render(<AddWorkspaceDialog dismissable={false} />);
    await userEvent.type(screen.getByLabelText(/name/i), 'Acme');
    await userEvent.type(screen.getByLabelText(/etherpad url/i), 'https://pads.acme.test');
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(window.etherpadDesktop.workspace.add).toHaveBeenCalledWith({
      name: 'Acme',
      serverUrl: 'https://pads.acme.test',
      color: expect.stringMatching(/^#/),
    });
  });

  it('shows ServerUnreachableError text on probe failure', async () => {
    // @ts-expect-error mock override
    window.etherpadDesktop.workspace.add = vi.fn().mockResolvedValue({
      ok: false,
      error: { kind: 'ServerUnreachableError', message: 'gone' },
    });
    render(<AddWorkspaceDialog dismissable={false} />);
    await userEvent.type(screen.getByLabelText(/name/i), 'X');
    await userEvent.type(screen.getByLabelText(/etherpad url/i), 'https://x');
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(await screen.findByText(/could not reach/i)).toBeInTheDocument();
  });

  it('Cancel button dismisses when allowed', async () => {
    dialogActions.openDialog('addWorkspace');
    render(<AddWorkspaceDialog dismissable={true} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(useShellStore.getState().openDialog).toBeNull();
  });

  it('Cancel button is hidden when not dismissable (first run)', () => {
    render(<AddWorkspaceDialog dismissable={false} />);
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  });

  it('shows NotAnEtherpadServerError text on probe failure', async () => {
    // @ts-expect-error mock override
    window.etherpadDesktop.workspace.add = vi.fn().mockResolvedValue({
      ok: false,
      error: { kind: 'NotAnEtherpadServerError', message: 'not etherpad' },
    });
    render(<AddWorkspaceDialog dismissable={false} />);
    await userEvent.type(screen.getByLabelText(/name/i), 'X');
    await userEvent.type(screen.getByLabelText(/etherpad url/i), 'https://x.example.com');
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(await screen.findByText(/does not look like etherpad/i)).toBeInTheDocument();
  });

  it('shows URL validation error text on invalid URL', async () => {
    // @ts-expect-error mock override
    window.etherpadDesktop.workspace.add = vi.fn().mockResolvedValue({
      ok: false,
      error: { kind: 'UrlValidationError', message: 'invalid url' },
    });
    render(<AddWorkspaceDialog dismissable={false} />);
    await userEvent.type(screen.getByLabelText(/name/i), 'X');
    await userEvent.type(screen.getByLabelText(/etherpad url/i), 'https://x.example.com');
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(await screen.findByText(/valid url/i)).toBeInTheDocument();
  });

  it('Add button is disabled when fields are empty', () => {
    render(<AddWorkspaceDialog dismissable={false} />);
    const addBtn = screen.getByRole('button', { name: /^add$/i });
    expect(addBtn).toBeDisabled();
  });

  it('Add button is disabled when only name is filled', async () => {
    render(<AddWorkspaceDialog dismissable={false} />);
    await userEvent.type(screen.getByLabelText(/name/i), 'SomeName');
    expect(screen.getByRole('button', { name: /^add$/i })).toBeDisabled();
  });

  it('Add button enabled when both name and URL are filled', async () => {
    render(<AddWorkspaceDialog dismissable={false} />);
    await userEvent.type(screen.getByLabelText(/name/i), 'SomeName');
    await userEvent.type(screen.getByLabelText(/etherpad url/i), 'https://x.example.com');
    expect(screen.getByRole('button', { name: /^add$/i })).not.toBeDisabled();
  });

  it('embedded: checkbox hides URL field and enables Add with just a name', async () => {
    render(<AddWorkspaceDialog dismissable={false} />);
    await userEvent.type(screen.getByLabelText(/name/i), 'Local');
    await userEvent.click(screen.getByRole('checkbox', { name: /use a local etherpad server/i }));

    // URL field should no longer be visible
    expect(screen.queryByLabelText(/etherpad url/i)).not.toBeInTheDocument();
    // Add should be enabled (name is filled + embedded mode)
    expect(screen.getByRole('button', { name: /^add$/i })).not.toBeDisabled();
  });

  it('embedded: submits with kind=embedded and no serverUrl', async () => {
    render(<AddWorkspaceDialog dismissable={false} />);
    await userEvent.type(screen.getByLabelText(/name/i), 'Local');
    await userEvent.click(screen.getByRole('checkbox', { name: /use a local etherpad server/i }));
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(window.etherpadDesktop.workspace.add).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Local', kind: 'embedded' }),
    );
    // Verify no serverUrl key in the call
    const callArgs = (window.etherpadDesktop.workspace.add as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs).not.toHaveProperty('serverUrl');
  });

  it('embedded: shows embeddedFailed error when server start fails', async () => {
    // @ts-expect-error mock override
    window.etherpadDesktop.workspace.add = vi.fn().mockResolvedValue({
      ok: false,
      error: { kind: 'StorageError', message: 'spawn failed' },
    });
    render(<AddWorkspaceDialog dismissable={false} />);
    await userEvent.type(screen.getByLabelText(/name/i), 'Local');
    await userEvent.click(screen.getByRole('checkbox', { name: /use a local etherpad server/i }));
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(await screen.findByText(/could not start the local etherpad server/i)).toBeInTheDocument();
  });

  it('embedded: hint text is shown when checkbox is checked', async () => {
    render(<AddWorkspaceDialog dismissable={false} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /use a local etherpad server/i }));
    expect(screen.getByText(/etherpad will run locally/i)).toBeInTheDocument();
  });

  it('clicking a color swatch changes the pressed state', async () => {
    render(<AddWorkspaceDialog dismissable={false} />);
    const swatches = screen.getAllByRole('button', { name: /colour/i });
    // First swatch starts pressed
    expect(swatches[0]).toHaveAttribute('aria-pressed', 'true');
    // Click the second swatch
    await userEvent.click(swatches[1]!);
    expect(swatches[1]).toHaveAttribute('aria-pressed', 'true');
    expect(swatches[0]).toHaveAttribute('aria-pressed', 'false');
  });

  it('submits with the selected color when a swatch is clicked', async () => {
    render(<AddWorkspaceDialog dismissable={false} />);
    const swatches = screen.getAllByRole('button', { name: /colour/i });
    const secondSwatch = swatches[1]!;
    const secondColor = secondSwatch.getAttribute('aria-label')?.replace('Colour ', '') ?? '';
    await userEvent.click(secondSwatch);
    await userEvent.type(screen.getByLabelText(/name/i), 'Acme');
    await userEvent.type(screen.getByLabelText(/etherpad url/i), 'https://pads.acme.test');
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(window.etherpadDesktop.workspace.add).toHaveBeenCalledWith(
      expect.objectContaining({ color: secondColor }),
    );
  });

  it('successful submit closes the dialog', async () => {
    dialogActions.openDialog('addWorkspace');
    render(<AddWorkspaceDialog dismissable={true} />);
    await userEvent.type(screen.getByLabelText(/name/i), 'Acme');
    await userEvent.type(screen.getByLabelText(/etherpad url/i), 'https://pads.acme.test');
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));
    // After success, dialog closes
    await vi.waitFor(() => expect(useShellStore.getState().openDialog).toBeNull());
  });
});
