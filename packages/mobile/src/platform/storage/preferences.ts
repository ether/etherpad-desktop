import { Preferences } from '@capacitor/preferences';
import type { ZodTypeAny, infer as zInfer } from 'zod';

/**
 * Read a Preferences key and parse it with the given Zod schema. Returns
 * `null` when the key is absent or the stored JSON doesn't match the
 * schema. Callers fall back to a default in that case rather than throw —
 * preferable to crashing the app on boot if disk data is malformed.
 */
export async function loadJson<S extends ZodTypeAny>(
  key: string,
  schema: S,
): Promise<zInfer<S> | null> {
  const { value } = await Preferences.get({ key });
  if (value === null) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    const result = schema.safeParse(parsed);
    return result.success ? (result.data as zInfer<S>) : null;
  } catch {
    return null;
  }
}

export async function saveJson<S extends ZodTypeAny>(
  key: string,
  schema: S,
  value: zInfer<S>,
): Promise<void> {
  // Validate before persisting so we never write a malformed blob.
  schema.parse(value);
  await Preferences.set({ key, value: JSON.stringify(value) });
}

export async function removeKey(key: string): Promise<void> {
  await Preferences.remove({ key });
}

export async function listKeys(): Promise<string[]> {
  const { keys } = await Preferences.keys();
  return keys;
}
