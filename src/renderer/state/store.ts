import { create } from 'zustand';
import type { Workspace } from '@shared/types/workspace';
import type { Settings } from '@shared/types/settings';
import type { OpenTab } from '@shared/types/tab';
import type { PadHistoryEntry } from '@shared/types/pad-history';

export type DialogKind =
  | 'addWorkspace'
  | 'openPad'
  | 'settings'
  | 'removeWorkspace'
  | 'httpAuth'
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

  hydrate(input: { workspaces: Workspace[]; workspaceOrder: string[]; settings: Settings }): void;
  setActiveWorkspaceId(id: string | null): void;
  replaceTabs(tabs: OpenTab[]): void;
  setActiveTabId(id: string | null): void;
  setPadHistory(workspaceId: string, entries: PadHistoryEntry[]): void;
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
};

export const useShellStore = create<ShellState>()((set) => ({
  ...initialState,

  hydrate: (input) =>
    set({
      workspaces: input.workspaces,
      workspaceOrder: input.workspaceOrder,
      settings: input.settings,
    }),
  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
  replaceTabs: (tabs) => set({ tabs }),
  setActiveTabId: (id) => set({ activeTabId: id }),
  setPadHistory: (workspaceId, entries) =>
    set((s) => ({ padHistory: { ...s.padHistory, [workspaceId]: entries } })),
}));

// Allow tests to reset the store to its initial state
useShellStore.getInitialState = () => ({ ...initialState });

// Dialog actions (separate to avoid the type collision between the field and the function above)
export const dialogActions = {
  openDialog: (kind: DialogKind, ctx: Record<string, unknown> = {}) =>
    useShellStore.setState({ openDialog: kind, dialogContext: ctx }),
  closeDialog: () => useShellStore.setState({ openDialog: null, dialogContext: {} }),
};
