import type { IpcResult, InitialState, Workspace } from '@shared/ipc/channels';
import { AppError } from '@shared/types/errors';

const api = window.etherpadDesktop;

async function unwrap<T>(p: Promise<IpcResult<T> | unknown>): Promise<T> {
  const r = (await p) as IpcResult<T>;
  if (r && typeof r === 'object' && 'ok' in r) {
    if (r.ok) return r.value;
    throw new AppError(r.error.kind, r.error.message);
  }
  return r as T;
}

export const ipc = {
  state: {
    getInitial: () => unwrap<InitialState>(api.state.getInitial() as never),
  },
  workspace: {
    list: () => unwrap<{ workspaces: Workspace[]; order: string[] }>(api.workspace.list() as never),
    add: (input: { name: string; serverUrl: string; color: string }) =>
      unwrap<Workspace>(api.workspace.add(input) as never),
    update: (input: { id: string; name?: string; serverUrl?: string; color?: string }) =>
      unwrap<Workspace>(api.workspace.update(input) as never),
    remove: (input: { id: string }) => unwrap<{ ok: true }>(api.workspace.remove(input) as never),
    reorder: (input: { order: string[] }) => unwrap<string[]>(api.workspace.reorder(input) as never),
  },
  tab: {
    open: (input: { workspaceId: string; padName: string; mode?: 'open' | 'create' }) =>
      unwrap<{ tabId: string; workspaceId: string; padName: string; title: string; state: string }>(
        api.tab.open(input) as never,
      ),
    close: (input: { tabId: string }) => unwrap<{ ok: true }>(api.tab.close(input) as never),
    focus: (input: { tabId: string }) => unwrap<{ ok: true }>(api.tab.focus(input) as never),
    reload: (input: { tabId: string }) => unwrap<{ ok: true }>(api.tab.reload(input) as never),
  },
  window: {
    setActiveWorkspace: (workspaceId: string | null) =>
      unwrap<{ ok: true }>(api.window.setActiveWorkspace({ workspaceId }) as never),
    reloadShell: () => unwrap<{ ok: true }>(api.window.reloadShell() as never),
  },
  padHistory: {
    list: (workspaceId: string) =>
      unwrap<Array<{ workspaceId: string; padName: string; lastOpenedAt: number; pinned: boolean; title?: string }>>(
        api.padHistory.list({ workspaceId }) as never,
      ),
    pin: (workspaceId: string, padName: string) =>
      unwrap<{ ok: true }>(api.padHistory.pin({ workspaceId, padName }) as never),
    unpin: (workspaceId: string, padName: string) =>
      unwrap<{ ok: true }>(api.padHistory.unpin({ workspaceId, padName }) as never),
    clearRecent: (workspaceId: string) =>
      unwrap<{ ok: true }>(api.padHistory.clearRecent({ workspaceId }) as never),
    clearAll: () => unwrap<{ ok: true }>(api.padHistory.clearAll() as never),
  },
  settings: {
    get: () => unwrap(api.settings.get() as never),
    update: (patch: Record<string, unknown>) => unwrap(api.settings.update(patch) as never),
  },
  httpLogin: {
    respond: (input: { requestId: string; cancel?: boolean; username?: string; password?: string }) =>
      unwrap<{ ok: true }>(api.httpLogin.respond(input) as never),
  },
  events: api.events,
};
