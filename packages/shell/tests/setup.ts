import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { __resetPlatformForTests, setPlatform, type Platform } from '../src/platform/ipc.js';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/**
 * Build a fully-mocked Platform. Every method resolves to `{ ok: true }`.
 * Sub-objects from `overrides` are deep-merged onto the base, so callers can
 * stub one method without restating the others.
 */
export function buildMockPlatform(overrides: DeepPartial<Platform> = {}): Platform {
  const noop = (): ReturnType<typeof vi.fn> => vi.fn().mockResolvedValue({ ok: true });
  const noopEvent = (): (() => void) => () => {};
  const base = {
    state: { getInitial: noop() },
    workspace: { list: noop(), add: noop(), update: noop(), remove: noop(), reorder: noop() },
    tab: { open: noop(), close: noop(), focus: noop(), reload: noop(), hardReload: noop() },
    window: {
      setActiveWorkspace: noop(),
      reloadShell: noop(),
      setPadViewsHidden: noop(),
      setRailCollapsed: noop(),
    },
    padHistory: {
      list: noop(),
      pin: noop(),
      unpin: noop(),
      clearRecent: noop(),
      clearAll: noop(),
    },
    settings: { get: noop(), update: noop() },
    httpLogin: { respond: noop() },
    updater: { checkNow: noop(), installAndRestart: noop(), getState: noop() },
    quickSwitcher: { searchPadContent: noop() },
    events: {
      onWorkspacesChanged: noopEvent,
      onPadHistoryChanged: noopEvent,
      onTabsChanged: noopEvent,
      onTabState: noopEvent,
      onSettingsChanged: noopEvent,
      onHttpLoginRequest: noopEvent,
      onUpdaterState: noopEvent,
      onPadFastSwitch: noopEvent,
      onMenuShellMessage: noopEvent,
    },
  } as unknown as Platform;
  const merged = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides)) {
    const existing = (merged[key] ?? {}) as Record<string, unknown>;
    merged[key] = { ...existing, ...(value as Record<string, unknown>) };
  }
  return merged as unknown as Platform;
}

// Compatibility shim: existing renderer tests inject mocks by mutating
// `window.etherpadDesktop`. Wire that mutation through `setPlatform()` so the
// shell's `getPlatform()` reads the updated value. Tests written after Phase 2a
// should call `setPlatform(buildMockPlatform({...}))` directly.
let currentPlatform: Platform = buildMockPlatform();
setPlatform(currentPlatform);

Object.defineProperty(window, 'etherpadDesktop', {
  configurable: true,
  get(): Platform {
    return currentPlatform;
  },
  set(value: Partial<Platform>): void {
    currentPlatform = { ...buildMockPlatform(), ...value } as Platform;
    setPlatform(currentPlatform);
  },
});

afterEach(() => {
  __resetPlatformForTests();
  currentPlatform = buildMockPlatform();
  setPlatform(currentPlatform);
});
