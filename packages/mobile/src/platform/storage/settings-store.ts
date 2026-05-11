import type { Settings } from '@shared/types/settings';
import { defaultSettings, settingsSchema } from '@shared/validation/settings';
import { loadJson, saveJson } from './preferences.js';

const KEY = 'etherpad:settings';

export async function get(): Promise<Settings> {
  const stored = await loadJson(KEY, settingsSchema);
  return stored ?? defaultSettings;
}

export async function update(patch: Partial<Settings>): Promise<Settings> {
  const current = await get();
  const next: Settings = { ...current, ...patch, schemaVersion: 1 };
  await saveJson(KEY, settingsSchema, next);
  return next;
}
