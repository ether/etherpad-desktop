import { create } from 'zustand';
import type { Workspace } from '@shared/types/workspace';
import type { Settings } from '@shared/types/settings';
import type { OpenTab } from '@shared/types/tab';
import type { PadHistoryEntry } from '@shared/types/pad-history';
import type { UpdaterState } from '@shared/types/updater';

export type DialogKind =
  | 'addWorkspace'
  | 'openPad'
  | 'openByUrl'
  | 'settings'
  | 'removeWorkspace'
  | 'clearAllHistory'
  | 'httpAuth'
  | 'about'
  | 'quickSwitcher'
  | null;

export type ShellState = {
  workspaces: Workspace[];
  workspaceOrder: string[];
  activeWorkspaceId: string | null;
  tabs: OpenTab[];
  activeTabId: string | null;
  padHistory: Record<string, PadHistoryEntry[]>;
  settings: Settings | null;
  openDialog: DialogKind;
  dialogContext: Record<string, unknown>;
  updaterState: UpdaterState;
  /** Whether the workspace rail is collapsed (session-local, not persisted). */
  railCollapsed: boolean;

  hydrate(input: {
    workspaces: Workspace[];
    workspaceOrder: string[];
    settings: Settings;
    padHistory?: Record<string, PadHistoryEntry[]>;
    railCollapsed?: boolean;
  }): void;
  setActiveWorkspaceId(id: string | null): void;
  replaceTabs(tabs: OpenTab[]): void;
  setActiveTabId(id: string | null): void;
  setPadHistory(workspaceId: string, entries: PadHistoryEntry[]): void;
  toggleRailCollapsed(): void;
  setRailCollapsed(value: boolean): void;
};

const initialState = {
  workspaces: [] as Workspace[],
  workspaceOrder: [] as string[],
  activeWorkspaceId: null as string | null,
  tabs: [] as OpenTab[],
  activeTabId: null as string | null,
  padHistory: {} as Record<string, PadHistoryEntry[]>,
  settings: null as Settings | null,
  openDialog: null as DialogKind,
  dialogContext: {} as Record<string, unknown>,
  updaterState: { kind: 'idle' } as UpdaterState,
  railCollapsed: false,
};

export const useShellStore = create<ShellState>()((set) => ({
  ...initialState,

  hydrate: (input) =>
    set({
      workspaces: input.workspaces,
      workspaceOrder: input.workspaceOrder,
      settings: input.settings,
      ...(input.padHistory ? { padHistory: input.padHistory } : {}),
      ...(input.railCollapsed !== undefined ? { railCollapsed: input.railCollapsed } : {}),
    }),
  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
  replaceTabs: (tabs) => set({ tabs }),
  setActiveTabId: (id) => set({ activeTabId: id }),
  setPadHistory: (workspaceId, entries) =>
    set((s) => ({ padHistory: { ...s.padHistory, [workspaceId]: entries } })),
  toggleRailCollapsed: () => set((s) => ({ railCollapsed: !s.railCollapsed })),
  setRailCollapsed: (value) => set({ railCollapsed: value }),
}));

// Allow tests to reset the store to its initial state
useShellStore.getInitialState = () => ({ ...initialState }) as unknown as ShellState;

// Dialog actions (separate to avoid the type collision between the field and the function above)
export const dialogActions = {
  openDialog: (kind: DialogKind, ctx: Record<string, unknown> = {}) =>
    useShellStore.setState({ openDialog: kind, dialogContext: ctx }),
  closeDialog: () => useShellStore.setState({ openDialog: null, dialogContext: {} }),
};
