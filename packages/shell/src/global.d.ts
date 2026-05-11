// Build-time constant. Each runtime (electron-vite for desktop, vite for
// mobile) injects this via its `define` config. AboutDialog renders it.
declare global {
  const __APP_VERSION__: string;
}

export {};
