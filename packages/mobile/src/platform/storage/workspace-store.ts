import type { Workspace } from '@shared/types/workspace';
import { workspacesFileSchema } from '@shared/validation/workspace';
import { loadJson, saveJson } from './preferences.js';

const KEY = 'etherpad:workspaces';

export interface WorkspacesFile {
  schemaVersion: 1;
  workspaces: Workspace[];
  order: string[];
}

export interface WorkspacesChangedPayload {
  workspaces: Workspace[];
  order: string[];
}

const listeners = new Set<(payload: WorkspacesChangedPayload) => void>();

function emitChanged(payload: WorkspacesChangedPayload): void {
  for (const l of listeners) l(payload);
}

export function onChanged(l: (payload: WorkspacesChangedPayload) => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

async function load(): Promise<WorkspacesFile> {
  const file = await loadJson(KEY, workspacesFileSchema);
  return file ?? { schemaVersion: 1, workspaces: [], order: [] };
}

async function save(file: WorkspacesFile): Promise<void> {
  await saveJson(KEY, workspacesFileSchema, file);
  emitChanged({ workspaces: file.workspaces, order: file.order });
}

export async function list(): Promise<{ workspaces: Workspace[]; order: string[] }> {
  const file = await load();
  return { workspaces: file.workspaces, order: file.order };
}

export async function add(input: {
  name: string;
  serverUrl?: string;
  color: string;
  kind?: 'remote' | 'embedded';
}): Promise<Workspace> {
  const file = await load();
  const ws: Workspace = {
    id: crypto.randomUUID(),
    name: input.name,
    serverUrl: input.serverUrl ?? '',
    color: input.color,
    createdAt: Date.now(),
    ...(input.kind ? { kind: input.kind } : {}),
  };
  file.workspaces.push(ws);
  file.order.push(ws.id);
  await save(file);
  return ws;
}

export async function update(input: {
  id: string;
  name?: string;
  serverUrl?: string;
  color?: string;
}): Promise<Workspace> {
  const file = await load();
  const ws = file.workspaces.find((w) => w.id === input.id);
  if (!ws) throw new Error(`Workspace ${input.id} not found`);
  if (input.name !== undefined) ws.name = input.name;
  if (input.serverUrl !== undefined) ws.serverUrl = input.serverUrl;
  if (input.color !== undefined) ws.color = input.color;
  await save(file);
  return ws;
}

export async function remove(input: { id: string }): Promise<void> {
  const file = await load();
  file.workspaces = file.workspaces.filter((w) => w.id !== input.id);
  file.order = file.order.filter((id) => id !== input.id);
  await save(file);
}

export async function reorder(input: { order: string[] }): Promise<string[]> {
  const file = await load();
  const known = new Set(file.workspaces.map((w) => w.id));
  for (const id of input.order) {
    if (!known.has(id)) throw new Error(`Unknown workspace ${id}`);
  }
  file.order = input.order;
  await save(file);
  return input.order;
}
