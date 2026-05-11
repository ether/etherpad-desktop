import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsDialog } from '../../src/dialogs/SettingsDialog';
import { useShellStore, dialogActions } from '../../src/state/store';
import type { Settings } from '../../src/types/settings';

const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 1,
  defaultZoom: 1,
  accentColor: '#3366cc',
  language: 'en',
  rememberOpenTabsOnQuit: true,
  minimizeToTray: false,
  themePreference: 'auto',
  userName: '',
};

beforeEach(() => {
  useShellStore.setState(useShellStore.getInitialState());
  useShellStore.setState({ settings: DEFAULT_SETTINGS });
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
    const selects = screen.getAllByRole('combobox');
    // First select is the language dropdown
    const langSelect = selects[0]!;
    const options = within(langSelect as HTMLSelectElement).getAllByRole('option');
    // Should have 115 locale options
    expect(options.length).toBe(115);
    // 'en' should be among them
    expect(options.some((o) => (o as HTMLOptionElement).value === 'en')).toBe(true);
    // 'es' should be among them
    expect(options.some((o) => (o as HTMLOptionElement).value === 'es')).toBe(true);
  });

  it('selecting a language and saving calls settings.update with the new language', async () => {
    render(<SettingsDialog />);
    const selects = screen.getAllByRole('combobox');
    // First select is the language dropdown
    await userEvent.selectOptions(selects[0]!, 'es');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(window.etherpadDesktop.settings.update).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'es' }),
    );
  });

  it('theme select exists with 3 options (auto/light/dark)', () => {
    render(<SettingsDialog />);
    const selects = screen.getAllByRole('combobox');
    // Second select is the theme dropdown
    const themeSelect = selects[1]!;
    const options = within(themeSelect as HTMLSelectElement).getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options.map((o) => (o as HTMLOptionElement).value)).toEqual(['auto', 'light', 'dark']);
  });

  it('changing theme and saving sends themePreference in the patch', async () => {
    render(<SettingsDialog />);
    const selects = screen.getAllByRole('combobox');
    const themeSelect = selects[1]!;
    await userEvent.selectOptions(themeSelect, 'dark');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(window.etherpadDesktop.settings.update).toHaveBeenCalledWith(
      expect.objectContaining({ themePreference: 'dark' }),
    );
  });

  it('toggling rememberOpenTabsOnQuit checkbox is reflected in update call', async () => {
    render(<SettingsDialog />);
    const checkbox = screen.getByRole('checkbox', { name: /remember open pads/i });
    // starts checked=true; uncheck it
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(window.etherpadDesktop.settings.update).toHaveBeenCalledWith(
      expect.objectContaining({ rememberOpenTabsOnQuit: false }),
    );
  });

  it('toggling minimise-to-tray checkbox and saving sends the field', async () => {
    useShellStore.setState({ settings: DEFAULT_SETTINGS });
    render(<SettingsDialog />);
    await userEvent.click(screen.getByRole('checkbox', { name: /minimise to system tray/i }));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(window.etherpadDesktop.settings.update).toHaveBeenCalledWith(
      expect.objectContaining({ minimizeToTray: true }),
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
