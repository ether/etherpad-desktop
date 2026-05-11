import { app } from 'electron';
import type { Logger } from '../logging/logger.js';
import type { UpdaterState } from '@shared/types/updater.js';

export type { UpdaterState };

export type UpdaterController = {
  /** Subscribe to state changes. Returns an unsubscribe fn. */
  onStateChange(cb: (s: UpdaterState) => void): () => void;
  /** Current state (sync read). */
  getState(): UpdaterState;
  /** Trigger a check now. */
  check(): Promise<void>;
  /** Apply a downloaded update by quitting + relaunching. */
  installAndRestart(): void;
  /** Start the periodic background-check loop. */
  startAutoCheck(intervalMs: number): void;
  /** Stop the loop (called on quit). */
  stop(): void;
};

/**
 * Minimal surface of autoUpdater that the controller actually uses.
 * Defined here so tests can supply a plain EventEmitter-shaped fake
 * without importing electron-updater at all.
 */
export type AutoUpdaterImpl = {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  on(event: string, listener: (...args: never[]) => void): void;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(isSilent: boolean, isForceRunAfter: boolean): void;
};

const UNSUPPORTED_DEV: UpdaterState = {
  kind: 'unsupported',
  reason: 'Auto-update is disabled in development.',
};

/**
 * Build the updater controller.
 *
 * Production: pass no `impl` — the function lazy-imports electron-updater.
 * Tests: pass a fake `AutoUpdaterImpl` via `opts.impl` to avoid module mocking.
 */
export async function createUpdater(opts: {
  log: Logger;
  /** Injected in tests; if omitted and app.isPackaged, the real electron-updater is used. */
  impl?: AutoUpdaterImpl;
}): Promise<UpdaterController> {
  const willUseUpdater = app.isPackaged || !!opts.impl;
  let state: UpdaterState = willUseUpdater ? { kind: 'idle' } : UNSUPPORTED_DEV;
  const subscribers = new Set<(s: UpdaterState) => void>();
  const setState = (next: UpdaterState) => {
    state = next;
    for (const cb of subscribers) cb(state);
  };

  let timer: ReturnType<typeof setInterval> | null = null;
  let updater: AutoUpdaterImpl | null = null;

  if (willUseUpdater) {
    if (opts.impl) {
      updater = opts.impl;
    } else {
      const mod = await import('electron-updater');
      updater = mod.autoUpdater as unknown as AutoUpdaterImpl;
    }
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = false; // we control restart via UI

    updater.on('checking-for-update', () => setState({ kind: 'checking' }));
    updater.on('update-available', (info: { version: string }) =>
      setState({ kind: 'available', version: info.version }),
    );
    updater.on('update-not-available', () => setState({ kind: 'idle' }));
    updater.on('download-progress', (p: { percent: number }) =>
      setState({ kind: 'downloading', percent: Math.round(p.percent) }),
    );
    updater.on('update-downloaded', (info: { version: string }) =>
      setState({ kind: 'ready', version: info.version }),
    );
    updater.on('error', (e: Error) => {
      opts.log.warn('updater error', { message: e.message });
      setState({ kind: 'error', message: e.message });
    });
  }

  const controller: UpdaterController = {
    onStateChange(cb) {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
    getState() {
      return state;
    },
    async check() {
      if (!updater) return;
      try {
        await updater.checkForUpdates();
      } catch (e) {
        opts.log.warn('updater check failed', { message: (e as Error).message });
        setState({ kind: 'error', message: (e as Error).message });
      }
    },
    installAndRestart() {
      if (!updater) return;
      updater.quitAndInstall(true, true);
    },
    startAutoCheck(intervalMs: number) {
      if (!updater) return;
      // Check on boot and every intervalMs after.
      void controller.check();
      if (timer) clearInterval(timer);
      timer = setInterval(() => void controller.check(), intervalMs);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };

  return controller;
}
