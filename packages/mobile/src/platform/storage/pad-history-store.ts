import type { PadHistoryEntry } from '@shared/types/pad-history';
import { padHistoryFileSchema } from '@shared/validation/pad-history';
import { listKeys, loadJson, removeKey, saveJson } from './preferences.js';

const PREFIX = 'etherpad:padHistory:';
const keyFor = (workspaceId: string): string => `${PREFIX}${workspaceId}`;

const changedListeners = new Set<(workspaceId: string) => void>();

export function onChanged(l: (workspaceId: string) => void): () => void {
  changedListeners.add(l);
  return () => {
    changedListeners.delete(l);
  };
}

function emitChanged(workspaceId: string): void {
  for (const l of changedListeners) l(workspaceId);
}

async function load(workspaceId: string): Promise<PadHistoryEntry[]> {
  const file = await loadJson(keyFor(workspaceId), padHistoryFileSchema);
  // Cast at the boundary: Zod's `.optional()` infers `title: string | undefined`
  // whereas `PadHistoryEntry.title` is `title?: string` (no `| undefined`)
  // under `exactOptionalPropertyTypes: true`. Same boundary cast as desktop's
  // pad-history-store.
  return (file?.entries ?? []) as PadHistoryEntry[];
}

async function save(workspaceId: string, entries: PadHistoryEntry[]): Promise<void> {
  await saveJson(keyFor(workspaceId), padHistoryFileSchema, { schemaVersion: 1, entries });
  emitChanged(workspaceId);
}

/**
 * Upsert a pad in the workspace's history. Idempotent: existing entries
 * get their `lastOpenedAt` bumped; new pads append. Called every time a
 * tab opens so the QuickSwitcher / sidebar Recents see fresh state.
 */
export async function upsert(input: { workspaceId: string; padName: string; title?: string }): Promise<void> {
  const entries = await load(input.workspaceId);
  const existing = entries.find((e) => e.padName === input.padName);
  if (existing) {
    existing.lastOpenedAt = Date.now();
    if (input.title !== undefined) existing.title = input.title;
  } else {
    const newEntry: PadHistoryEntry = {
      workspaceId: input.workspaceId,
      padName: input.padName,
      lastOpenedAt: Date.now(),
      pinned: false,
      ...(input.title !== undefined ? { title: input.title } : {}),
    };
    entries.push(newEntry);
  }
  await save(input.workspaceId, entries);
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
