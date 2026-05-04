export type Workspace = {
  id: string;
  name: string;
  serverUrl: string;
  color: string;
  createdAt: number;
};

export type WorkspacesFile = {
  schemaVersion: 1;
  workspaces: Workspace[];
  order: string[];
};
