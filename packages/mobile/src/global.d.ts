// Build-time constant injected by Vite's `define` option.
declare global {
  const __APP_VERSION__: string;
}

// CSS side-effect imports. The shell exports its stylesheet via its
// package.json "exports" map; declare the bare module path so tsc accepts
// the side-effect import. Vite resolves the actual file at build time.
declare module '*.css';
declare module '@etherpad/shell/styles/index.css';

export {};
