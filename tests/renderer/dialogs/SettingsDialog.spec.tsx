import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsDialog } from '../../../src/renderer/dialogs/SettingsDialog';
import { useShellStore, dialogActions } from '../../../src/renderer/state/store';

const DEFAULT_SETTINGS = {
  schemaVersion: 1,
  defaultZoom: 1,
  accentColor: '#3366cc',
  language: 'en',
  rememberOpenTabsOnQuit: true,
};

beforeEach(() => {
  useShellStore.setState(useShellStore.getInitialState());
  useShellStore.setState({ settings: DEFAULT_SETTINGS });
  // @ts-expect-error -- mock partial window.etherpadDesktop for test
  window.etherpadDesktop = {
    settings: { update: vi.fn().mockResolvedValue({ ok: true, value: {} }) },
    padHistory: { clearAll: vi.fn().mockResolvedValue({ ok: true }) },
    window: { setActiveWorkspace: vi.fn().mockResolvedValue({ ok: true }) },
    workspace: { remove: vi.fn().mockResolvedValue({ ok: true }) },
  };
});

describe('SettingsDialog', () => {
  it('saves with the patched zoom value', async () => {
    render(<SettingsDialog />);
    const zoom = screen.getByRole('spinbutton');
    await userEvent.clear(zoom);
    await userEvent.type(zoom, '1.5');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(window.etherpadDesktop.settings.update).toHaveBeenCalledWith(
      expect.objectContaining({ defaultZoom: 1.5 }),
    );
  });

  it('renders a language dropdown with multiple options', () => {
    render(<SettingsDialog />);
    const select = screen.getByRole('combobox');
    const options = within(select as HTMLSelectElement).getAllByRole('option');
    // Should have 115 locale options
    expect(options.length).toBe(115);
    // 'en' should be among them
    expect(options.some((o) => (o as HTMLOptionElement).value === 'en')).toBe(true);
    // 'es' should be among them
    expect(options.some((o) => (o as HTMLOptionElement).value === 'es')).toBe(true);
  });

  it('selecting a language and saving calls settings.update with the new language', async () => {
    render(<SettingsDialog />);
    const select = screen.getByRole('combobox');
    await userEvent.selectOptions(select, 'es');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(window.etherpadDesktop.settings.update).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'es' }),
    );
  });

  it('toggling rememberOpenTabsOnQuit checkbox is reflected in update call', async () => {
    render(<SettingsDialog />);
    const checkbox = screen.getByRole('checkbox');
    // starts checked=true; uncheck it
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(window.etherpadDesktop.settings.update).toHaveBeenCalledWith(
      expect.objectContaining({ rememberOpenTabsOnQuit: false }),
    );
  });

  it('Save button closes the dialog', async () => {
    dialogActions.openDialog('settings');
    render(<SettingsDialog />);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await vi.waitFor(() => expect(useShellStore.getState().openDialog).toBeNull());
  });

  it('Cancel button closes the dialog without calling update', async () => {
    dialogActions.openDialog('settings');
    render(<SettingsDialog />);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(useShellStore.getState().openDialog).toBeNull();
    expect(window.etherpadDesktop.settings.update).not.toHaveBeenCalled();
  });

  it('Clear All History button calls padHistory.clearAll', async () => {
    render(<SettingsDialog />);
    await userEvent.click(screen.getByRole('button', { name: /clear all pad history/i }));
    expect(window.etherpadDesktop.padHistory.clearAll).toHaveBeenCalled();
  });

  it('Remove button next to a workspace opens RemoveWorkspaceDialog with that workspaceId', async () => {
    useShellStore.setState({
      settings: DEFAULT_SETTINGS,
      workspaces: [
        { id: 'ws1', name: 'Alpha', serverUrl: 'https://a', color: '#000', createdAt: 1 },
      ],
      workspaceOrder: ['ws1'],
    });
    render(<SettingsDialog />);
    await userEvent.click(screen.getByRole('button', { name: /^remove$/i }));
    expect(useShellStore.getState().openDialog).toBe('removeWorkspace');
    expect((useShellStore.getState().dialogContext as { workspaceId: string }).workspaceId).toBe('ws1');
  });

  it('renders a Remove button for each workspace', () => {
    useShellStore.setState({
      settings: DEFAULT_SETTINGS,
      workspaces: [
        { id: 'ws1', name: 'Alpha', serverUrl: 'https://a', color: '#000', createdAt: 1 },
        { id: 'ws2', name: 'Beta', serverUrl: 'https://b', color: '#111', createdAt: 2 },
      ],
      workspaceOrder: ['ws1', 'ws2'],
    });
    render(<SettingsDialog />);
    expect(screen.getAllByRole('button', { name: /^remove$/i })).toHaveLength(2);
  });
});
