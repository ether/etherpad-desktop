import { z } from 'zod';
import { workspaceSchema } from '../validation/workspace.js';
import { padHistoryEntrySchema } from '../validation/pad-history.js';
import { settingsSchema } from '../validation/settings.js';
import type { OpenTab, TabState } from '../types/tab.js';
import type { Workspace } from '../types/workspace.js';
import type { PadHistoryEntry } from '../types/pad-history.js';
import type { Settings } from '../types/settings.js';
import type { SerializedAppError } from '../types/errors.js';

// --- Channel name constants ---
export const CH = {
  GET_INITIAL_STATE: 'state.getInitial',
  WORKSPACE_LIST: 'workspace.list',
  WORKSPACE_ADD: 'workspace.add',
  WORKSPACE_UPDATE: 'workspace.update',
  WORKSPACE_REMOVE: 'workspace.remove',
  WORKSPACE_REORDER: 'workspace.reorder',
  TAB_OPEN: 'tab.open',
  TAB_CLOSE: 'tab.close',
  TAB_FOCUS: 'tab.focus',
  TAB_RELOAD: 'tab.reload',
  WINDOW_SET_ACTIVE_WORKSPACE: 'window.setActiveWorkspace',
  WINDOW_RELOAD_SHELL: 'window.reloadShell',
  WINDOW_GET_INITIAL: 'window.getInitial',
  WINDOW_SET_PAD_VIEWS_HIDDEN: 'window.setPadViewsHidden',
  PAD_HISTORY_LIST: 'padHistory.list',
  PAD_HISTORY_PIN: 'padHistory.pin',
  PAD_HISTORY_UNPIN: 'padHistory.unpin',
  PAD_HISTORY_CLEAR_RECENT: 'padHistory.clearRecent',
  PAD_HISTORY_CLEAR_ALL: 'padHistory.clearAll',
  SETTINGS_GET: 'settings.get',
  SETTINGS_UPDATE: 'settings.update',
  EV_WORKSPACES_CHANGED: 'event.workspacesChanged',
  EV_PAD_HISTORY_CHANGED: 'event.padHistoryChanged',
  EV_TABS_CHANGED: 'event.tabsChanged',
  EV_TAB_STATE: 'event.tabState',
  EV_SETTINGS_CHANGED: 'event.settingsChanged',
  EV_HTTP_LOGIN_REQUEST: 'event.httpLoginRequest',
} as const;

// --- Payload schemas ---
export const workspaceAddPayload = z.object({
  name: z.string().min(1).max(80),
  serverUrl: z.string().url(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
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
