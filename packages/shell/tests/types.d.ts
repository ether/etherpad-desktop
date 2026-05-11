// Tests-only ambient declaration. The setup file installs a property on
// `window.etherpadDesktop` that, when assigned, also calls setPlatform()
// so legacy "mutate the global" test patterns continue to work.
// Typed as `any` so tests can assign partial mocks (`{ tab: { close: fn } }`)
// without restating the full Platform shape, mirroring the pre-Phase-2a
// `// @ts-expect-error mock` ergonomics.
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    etherpadDesktop: any;
  }
}

export {};
