import type { EtherpadDesktopApi } from '../preload/index.js';

declare global {
  interface Window {
    etherpadDesktop: EtherpadDesktopApi;
  }
}

export {};
