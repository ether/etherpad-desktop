import type { PadHistoryEntry } from '@shared/types/pad-history';
import { padHistoryFileSchema } from '@shared/validation/pad-history';
import { listKeys, loadJson, removeKey, saveJson } from './preferences.js';

const PREFIX = 'etherpad:padHistory:';
const keyFor = (workspaceId: string): string => `${PREFIX}${workspaceId}`;

async function load(workspaceId: string): Promise<PadHistoryEntry[]> {
  const file = await loadJson(keyFor(workspaceId), padHistoryFileSchema);
  return file?.entries ?? [];
}

async function save(workspaceId: string, entries: PadHistoryEntry[]): Promise<void> {
  await saveJson(keyFor(workspaceId), padHistoryFileSchema, { schemaVersion: 1, entries });
}

export async function list(input: { workspaceId: string }): Promise<PadHistoryEntry[]> {
  return load(input.workspaceId);
}

export async function pin(input: { workspaceId: string; padName: string }): Promise<void> {
  const entries = await load(input.workspaceId);
  const e = entries.find((x) => x.padName === input.padName);
  if (e) e.pinned = true;
  await save(input.workspaceId, entries);
}

export async function unpin(input: { workspaceId: string; padName: string }): Promise<void> {
  const entries = await load(input.workspaceId);
  const e = entries.find((x) => x.padName === input.padName);
  if (e) e.pinned = false;
  await save(input.workspaceId, entries);
}

export async function clearRecent(input: { workspaceId: string }): Promise<void> {
  const entries = (await load(input.workspaceId)).filter((e) => e.pinned);
  await save(input.workspaceId, entries);
}

export async function clearAll(): Promise<void> {
  const keys = await listKeys();
  for (const key of keys) {
    if (key.startsWith(PREFIX)) await removeKey(key);
  }
}

/** Used by `state.getInitial()` to bundle history for every known workspace. */
export async function loadAll(workspaceIds: string[]): Promise<Record<string, PadHistoryEntry[]>> {
  const result: Record<string, PadHistoryEntry[]> = {};
  for (const id of workspaceIds) result[id] = await load(id);
  return result;
}
