import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickSwitcherDialog } from '../../../src/renderer/dialogs/QuickSwitcherDialog';
import { useShellStore, dialogActions } from '../../../src/renderer/state/store';

const WS_A = { id: 'a', name: 'Alpha', serverUrl: 'https://a', color: '#11aa11', createdAt: 1 };
const WS_B = { id: 'b', name: 'Beta', serverUrl: 'https://b', color: '#aa1111', createdAt: 2 };

beforeEach(() => {
  useShellStore.setState(useShellStore.getInitialState());
  useShellStore.setState({
    workspaces: [WS_A, WS_B],
    workspaceOrder: ['a', 'b'],
    padHistory: {
      a: [
        { workspaceId: 'a', padName: 'standup', lastOpenedAt: 100, pinned: false },
        { workspaceId: 'a', padName: 'retro', lastOpenedAt: 90, pinned: false },
      ],
      b: [{ workspaceId: 'b', padName: 'roadmap', lastOpenedAt: 110, pinned: false }],
    },
  });
  dialogActions.openDialog('quickSwitcher');
  // @ts-expect-error mock
  window.etherpadDesktop = {
    window: { setActiveWorkspace: vi.fn().mockResolvedValue({ ok: true, value: { ok: true } }) },
    tab: { open: vi.fn().mockResolvedValue({ ok: true, value: { tabId: 't' } }) },
  };
});

describe('QuickSwitcherDialog', () => {
  it('shows recent pads (top 10) when query is empty, sorted by lastOpenedAt desc', () => {
    render(<QuickSwitcherDialog />);
    const rows = screen.getAllByRole('option');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('roadmap'); // lastOpenedAt 110
    expect(rows[1]).toHaveTextContent('standup'); // 100
    expect(rows[2]).toHaveTextContent('retro'); //  90
  });

  it('matches workspace by name (case-insensitive)', async () => {
    render(<QuickSwitcherDialog />);
    await userEvent.type(screen.getByRole('textbox'), 'BET');
    const rows = screen.getAllByRole('option');
    expect(rows.some((r) => r.textContent?.includes('Beta'))).toBe(true);
  });

  it('matches pad by padName (case-insensitive)', async () => {
    render(<QuickSwitcherDialog />);
    await userEvent.type(screen.getByRole('textbox'), 'STAND');
    const rows = screen.getAllByRole('option');
    expect(rows.some((r) => r.textContent?.includes('standup'))).toBe(true);
  });

  it('selecting a workspace result calls setActiveWorkspace and closes dialog', async () => {
    render(<QuickSwitcherDialog />);
    await userEvent.type(screen.getByRole('textbox'), 'Beta');
    await userEvent.click(screen.getByRole('option', { name: /Beta/ }));
    expect(window.etherpadDesktop.window.setActiveWorkspace).toHaveBeenCalledWith({
      workspaceId: 'b',
    });
    expect(window.etherpadDesktop.tab.open).not.toHaveBeenCalled();
    expect(useShellStore.getState().openDialog).toBeNull();
  });

  it('selecting a pad result calls setActiveWorkspace + tab.open and closes dialog', async () => {
    render(<QuickSwitcherDialog />);
    await userEvent.type(screen.getByRole('textbox'), 'roadmap');
    await userEvent.click(screen.getByRole('option', { name: /roadmap/ }));
    expect(window.etherpadDesktop.window.setActiveWorkspace).toHaveBeenCalledWith({
      workspaceId: 'b',
    });
    expect(window.etherpadDesktop.tab.open).toHaveBeenCalledWith({
      workspaceId: 'b',
      padName: 'roadmap',
      mode: 'open',
    });
    expect(useShellStore.getState().openDialog).toBeNull();
  });

  it('Escape closes the dialog', async () => {
    render(<QuickSwitcherDialog />);
    const input = screen.getByRole('textbox');
    input.focus();
    await userEvent.keyboard('{Escape}');
    expect(useShellStore.getState().openDialog).toBeNull();
  });

  it('ArrowDown moves selection then Enter activates', async () => {
    render(<QuickSwitcherDialog />);
    const input = screen.getByRole('textbox');
    input.focus();
    // Empty query → 3 recent pads, selected=0 (roadmap)
    await userEvent.keyboard('{ArrowDown}'); // selected=1 (standup)
    await userEvent.keyboard('{Enter}');
    expect(window.etherpadDesktop.tab.open).toHaveBeenCalledWith({
      workspaceId: 'a',
      padName: 'standup',
      mode: 'open',
    });
  });

  it('shows "No matches" when query has no hits', async () => {
    render(<QuickSwitcherDialog />);
    await userEvent.type(screen.getByRole('textbox'), 'xyznomatch');
    expect(screen.getByText(/no matches/i)).toBeInTheDocument();
  });
});
