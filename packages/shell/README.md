# @etherpad/shell

React-based renderer shell shared between `@etherpad/desktop` (Electron) and `@etherpad/mobile` (Capacitor). Owns the workspaces / pads / tabs UI, Zustand state, i18n, and the `Platform` injection seam.

This package is consumed as source via pnpm workspace `workspace:*` — no separate build step. Imports resolve into `src/` directly.

Tests run with vitest jsdom and inject a mock `Platform` via `setPlatform()` in `tests/setup.ts`.
