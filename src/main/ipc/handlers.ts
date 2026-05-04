import type { AppContext } from '../app/lifecycle.js';

export function registerIpc(_ctx: AppContext) {
  return {
    broadcastShell: (_channel: string, _payload?: unknown) => {},
    emitTabsChanged: () => {},
    emitTabState: (_window: unknown, _s: { tabId: string; state: string; errorMessage?: string; title?: string }) => {},
    requestHttpLogin: async (_host: string, _realm?: string) =>
      ({ cancel: true, requestId: '' }) as { cancel: boolean; requestId: string; username?: string; password?: string },
  };
}
