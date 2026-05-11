import type { EtherpadDesktopApi } from '../preload/index.js';

declare global {
  interface Window {
    etherpadDesktop: EtherpadDesktopApi;
  }

  // Build-time constant injected by electron-vite's define option
  const __APP_VERSION__: string;
}

export {};
