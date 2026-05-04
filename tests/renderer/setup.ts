import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Provide a minimal global stub so ipc/api.ts can evaluate at module-load time.
// Individual tests may override window.etherpadDesktop in their own beforeEach.
const noop = vi.fn().mockResolvedValue({ ok: true });
const noopEvents = () => noop;

Object.defineProperty(window, 'etherpadDesktop', {
  writable: true,
  configurable: true,
  value: {
    state: { getInitial: noop },
    workspace: { list: noop, add: noop, update: noop, remove: noop, reorder: noop },
    tab: { open: noop, close: noop, focus: noop, reload: noop },
    window: { setActiveWorkspace: noop, reloadShell: noop },
    padHistory: { list: noop, pin: noop, unpin: noop, clearRecent: noop, clearAll: noop },
    settings: { get: noop, update: noop },
    httpLogin: { respond: noop },
    events: {
      onWorkspacesChanged: noopEvents,
      onTabsChanged: noopEvents,
      onTabState: noopEvents,
      onPadHistoryChanged: noopEvents,
      onHttpLoginRequest: noopEvents,
      onMenuShellMessage: noopEvents,
    },
  },
});
