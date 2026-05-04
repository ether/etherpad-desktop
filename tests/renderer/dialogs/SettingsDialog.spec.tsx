import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsDialog } from '../../../src/renderer/dialogs/SettingsDialog';
import { useShellStore } from '../../../src/renderer/state/store';

beforeEach(() => {
  useShellStore.setState(useShellStore.getInitialState());
  useShellStore.setState({
    settings: {
      schemaVersion: 1,
      defaultZoom: 1,
      accentColor: '#3366cc',
      language: 'en',
      rememberOpenTabsOnQuit: true,
    },
  });
  // @ts-expect-error -- mock partial window.etherpadDesktop for test
  window.etherpadDesktop = {
    settings: { update: vi.fn().mockResolvedValue({ ok: true, value: {} }) },
    padHistory: { clearAll: vi.fn().mockResolvedValue({ ok: true }) },
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
});
