/**
 * Discriminated-union state for the auto-updater.
 * Shared between main and renderer — no electron-updater import here.
 */
export type UpdaterState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available'; version: string }
  | { kind: 'downloading'; percent: number }
  | { kind: 'ready'; version: string }
  | { kind: 'error'; message: string }
  | { kind: 'unsupported'; reason: string };
