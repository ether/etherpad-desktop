export type PadHistoryEntry = {
  workspaceId: string;
  padName: string;
  lastOpenedAt: number;
  pinned: boolean;
  title?: string;
};

export type PadHistoryFile = {
  schemaVersion: 1;
  entries: PadHistoryEntry[];
};

export const PAD_HISTORY_UNPINNED_CAP = 200;
