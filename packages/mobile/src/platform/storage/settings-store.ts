import type { Settings } from '@shared/types/settings';
import { defaultSettings, settingsSchema } from '@shared/validation/settings';
import { loadJson, saveJson } from './preferences.js';

const KEY = 'etherpad:settings';

const listeners = new Set<(next: Settings) => void>();

export function onChanged(l: (next: Settings) => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function emitChanged(next: Settings): void {
  for (const l of listeners) l(next);
}

export async function get(): Promise<Settings> {
  const stored = await loadJson(KEY, settingsSchema);
  return stored ?? defaultSettings;
}

export async function update(patch: Partial<Settings>): Promise<Settings> {
  const current = await get();
  const next: Settings = { ...current, ...patch, schemaVersion: 1 };
  await saveJson(KEY, settingsSchema, next);
  emitChanged(next);
  return next;
}
