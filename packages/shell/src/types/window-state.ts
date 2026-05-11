export type PersistedTab = { workspaceId: string; padName: string };

export type PersistedWindow = {
  activeWorkspaceId: string | null;
  bounds: { x: number; y: number; width: number; height: number };
  openTabs: PersistedTab[];
  activeTabIndex: number;
};

export type WindowState = {
  schemaVersion: 1;
  windows: PersistedWindow[];
};
