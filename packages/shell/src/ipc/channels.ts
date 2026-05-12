import { z } from 'zod';
import { workspaceSchema } from '../validation/workspace.js';
import { padHistoryEntrySchema } from '../validation/pad-history.js';
import { settingsSchema } from '../validation/settings.js';
import type { OpenTab, TabState } from '../types/tab.js';
import type { Workspace } from '../types/workspace.js';
import type { PadHistoryEntry } from '../types/pad-history.js';
import type { Settings } from '../types/settings.js';
import type { SerializedAppError } from '../types/errors.js';

// Channel name constants live in their own zero-dep module so the preload
// bundle doesn't transitively pull in zod (which can't be resolved in
// Electron's sandboxed preload context).
export { CH } from './channel-names.js';

// --- Payload schemas ---
export const workspaceAddPayload = z.object({
  name: z.string().min(1).max(80),
  // serverUrl is omitted when kind === 'embedded' (the embedded server
  // assigns its own URL).
  serverUrl: z.string().url().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  kind: z.enum(['remote', 'embedded']).optional(),
});

export const workspaceUpdatePayload = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80).optional(),
  serverUrl: z.string().url().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

export const workspaceRemovePayload = z.object({ id: z.string().uuid() });
export const workspaceReorderPayload = z.object({ order: z.array(z.string().uuid()) });

export const tabOpenPayload = z.object({
  workspaceId: z.string().uuid(),
  padName: z.string().min(1).max(200),
  mode: z.enum(['open', 'create']).default('open'),
});

export const tabIdPayload = z.object({ tabId: z.string().min(1) });
export const setActiveWorkspacePayload = z.object({
  workspaceId: z.string().uuid().nullable(),
});

export const setPadViewsHiddenPayload = z.object({ hidden: z.boolean() });

export const setRailCollapsedPayload = z.object({ collapsed: z.boolean() });

export const padHistoryListPayload = z.object({ workspaceId: z.string().uuid() });
export const padHistoryMutatePayload = z.object({
  workspaceId: z.string().uuid(),
  padName: z.string().min(1).max(200),
});

export const settingsUpdatePayload = settingsSchema.omit({ schemaVersion: true }).partial().strict();

export const httpLoginRequestEvent = z.object({
  requestId: z.string().min(1),
  url: z.string().url(),
  realm: z.string().optional(),
});

export const httpLoginResponsePayload = z.object({
  requestId: z.string().min(1),
  username: z.string().min(1).optional(),
  password: z.string().optional(),
  cancel: z.boolean().default(false),
});

// --- Result types ---
export type InitialState = {
  workspaces: Workspace[];
  workspaceOrder: string[];
  settings: Settings;
  /** Pad history per workspace, eagerly bundled so the sidebar can render
   *  Recent/Pinned on first paint without waiting for a touch event. */
  padHistory: Record<string, PadHistoryEntry[]>;
  /** Workspace the user was on last time the app closed. When set, App.tsx
   *  prefers it over `workspaceOrder[0]`. Used by mobile's
   *  `rememberOpenTabsOnQuit` flow; desktop main can populate it too if
   *  it persists window state. Omitted on first launch (no prior session). */
  activeWorkspaceId?: string;
};

export type TabSummary = OpenTab & { tabId: string };

export type TabStateChange = {
  tabId: string;
  state: TabState;
  errorMessage?: string;
  title?: string;
};

export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: SerializedAppError };

export type {
  Workspace,
  PadHistoryEntry,
  Settings,
  TabState,
  OpenTab,
};

// Re-export value schemas so consumers have a single import point
export { workspaceSchema, padHistoryEntrySchema };
