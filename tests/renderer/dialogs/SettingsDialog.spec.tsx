import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsDialog } from '../../../src/renderer/dialogs/SettingsDialog';
import { useShellStore, dialogActions } from '../../../src/renderer/state/store';

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
  // @ts-expect-error
  window.etherpadDesktop = {
    settings: { update: vi.fn().mockResolvedValue({ ok: true, value: {} }) },
    padHistory: { clearAll: vi.fn().mockResolvedValue({ ok: true }) },
  };
});

describe('SettingsDialog', () => {
  it('saves with the patched values', async () => {
    render(<SettingsDialog />);
    const zoom = screen.getByLabelText(/default zoom/i);
    await userEvent.clear(zoom);
    await userEvent.type(zoom, '1.5');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(window.etherpadDesktop.settings.update).toHaveBeenCalledWith(
      expect.objectContaining({ defaultZoom: 1.5 }),
    );
  });
});
