import type { Platform } from '@etherpad/shell';

/**
 * Adapter exposing the preload-injected `window.etherpadDesktop` as a
 * `Platform`. The shapes are structurally identical (preload's
 * `EtherpadDesktopApi` was the original source of truth and `Platform`
 * is a verbatim rename); this function exists to make the boundary
 * explicit and to give a single place to add desktop-specific shimming
 * later.
 */
export function createElectronPlatform(): Platform {
  if (typeof window === 'undefined' || !window.etherpadDesktop) {
    throw new Error('window.etherpadDesktop is missing — preload did not expose it.');
  }
  // The preload-injected object doesn't have `capabilities` baked in
  // — declare them here, where the runtime is known to be Electron.
  return {
    capabilities: { tray: true },
    ...(window.etherpadDesktop as unknown as Omit<Platform, 'capabilities'>),
  };
}
