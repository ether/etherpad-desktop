import type { Platform } from '@etherpad/shell';
import * as workspaceStore from './storage/workspace-store.js';
import * as padHistoryStore from './storage/pad-history-store.js';
import * as settingsStore from './storage/settings-store.js';

/**
 * Concrete `Platform` impl for mobile. Workspace, pad-history, and settings
 * persistence go through `@capacitor/preferences` (web fallback = localStorage
 * with `CapacitorStorage.<key>` prefix). Pad rendering (`tab.*`),
 * desktop-specific surfaces (`httpLogin`, `updater`), and pad-content search
 * remain stubbed — they land in Phase 5+ alongside `PadIframeStack` and the
 * deep-links / share / permissions plugin.
 *
 * All write paths funnel through `wrap()` so a thrown error inside a store
 * surfaces to the shell as a typed `{ ok: false, error: ... }` envelope
 * (consumed by `ipc.ts`'s `unwrap()`).
 */
export function createCapacitorPlatform(): Platform {
  const ok = Promise.resolve({ ok: true });
  const wrap = async <T>(
    fn: () => Promise<T>,
  ): Promise<{ ok: true; value: T } | { ok: false; error: { kind: string; message: string } }> => {
    try {
      const value = await fn();
      return { ok: true, value };
    } catch (err) {
      return {
        ok: false,
        error: {
          kind: 'UnknownError',
          message: err instanceof Error ? err.message : String(err),
        },
      };
    }
  };
  const notImpl = (
    op: string,
  ): Promise<{ ok: false; error: { kind: string; message: string } }> =>
    Promise.resolve({
      ok: false,
      error: { kind: 'NotImplementedError', message: `[mobile] ${op} not implemented yet` },
    });
  const noopUnsubscribe = (): (() => void) => () => {};

  return {
    state: {
      getInitial: () =>
        wrap(async () => {
          const { workspaces, order } = await workspaceStore.list();
          const settings = await settingsStore.get();
          const padHistory = await padHistoryStore.loadAll(order);
          return {
            workspaces,
            workspaceOrder: order,
            settings,
            padHistory,
          };
        }),
    },
    workspace: {
      list: () => wrap(workspaceStore.list),
      add: (input) => wrap(() => workspaceStore.add(input)),
      update: (input) => wrap(() => workspaceStore.update(input)),
      remove: (input) =>
        wrap(async () => {
          await workspaceStore.remove(input);
          return { ok: true } as const;
        }),
      reorder: (input) => wrap(() => workspaceStore.reorder(input)),
    },
    tab: {
      open: () => notImpl('tab.open'),
      close: () => notImpl('tab.close'),
      focus: () => notImpl('tab.focus'),
      reload: () => notImpl('tab.reload'),
      hardReload: () => notImpl('tab.hardReload'),
    },
    window: {
      setActiveWorkspace: () => ok,
      reloadShell: () => {
        window.location.reload();
        return ok;
      },
      setPadViewsHidden: () => ok,
      setRailCollapsed: () => ok,
    },
    padHistory: {
      list: (input) => wrap(() => padHistoryStore.list(input)),
      pin: (input) =>
        wrap(async () => {
          await padHistoryStore.pin(input);
          return { ok: true } as const;
        }),
      unpin: (input) =>
        wrap(async () => {
          await padHistoryStore.unpin(input);
          return { ok: true } as const;
        }),
      clearRecent: (input) =>
        wrap(async () => {
          await padHistoryStore.clearRecent(input);
          return { ok: true } as const;
        }),
      clearAll: () =>
        wrap(async () => {
          await padHistoryStore.clearAll();
          return { ok: true } as const;
        }),
    },
    settings: {
      get: () => wrap(settingsStore.get),
      update: (patch) =>
        wrap(() => settingsStore.update(patch as Parameters<typeof settingsStore.update>[0])),
    },
    httpLogin: {
      respond: () => notImpl('httpLogin.respond'),
    },
    updater: {
      checkNow: () => notImpl('updater.checkNow'),
      installAndRestart: () => notImpl('updater.installAndRestart'),
      // Raw (not unwrapped) — return UpdaterState shape directly.
      getState: () => Promise.resolve({ kind: 'unsupported', reason: 'mobile' }),
    },
    quickSwitcher: {
      // Raw (not unwrapped) — return an array directly.
      searchPadContent: () => Promise.resolve([]),
    },
    events: {
      onWorkspacesChanged: noopUnsubscribe,
      onPadHistoryChanged: noopUnsubscribe,
      onTabsChanged: noopUnsubscribe,
      onTabState: noopUnsubscribe,
      onSettingsChanged: noopUnsubscribe,
      onHttpLoginRequest: noopUnsubscribe,
      onUpdaterState: noopUnsubscribe,
      onPadFastSwitch: noopUnsubscribe,
      onMenuShellMessage: noopUnsubscribe,
    },
  };
}
