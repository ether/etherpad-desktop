export type WorkspaceKind = 'remote' | 'embedded';

export type Workspace = {
  id: string;
  name: string;
  serverUrl: string;
  color: string;
  createdAt: number;
  // Optional for back-compat — existing persisted workspaces have no `kind`
  // and are interpreted as `'remote'`.
  // `| undefined` keeps this compatible with Zod's `.optional()` inference
  // under `exactOptionalPropertyTypes: true`.
  kind?: WorkspaceKind | undefined;
};

export type WorkspacesFile = {
  schemaVersion: 1;
  workspaces: Workspace[];
  order: string[];
};
