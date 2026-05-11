# Shell — agent orientation

The renderer shell shared by desktop and mobile. Owns:

- `App.tsx`, `components/`, `dialogs/`, `rail/`, `sidebar/`, `tabs/`, `state/`,
  `i18n/`, `styles/`, `theme.ts`
- `ipc/` — typed channel names and result types (no Electron-IPC runtime)
- `types/`, `validation/` — Zod schemas and TS types for cross-runtime payloads
- `platform/ipc.ts` — the `Platform` interface, `setPlatform()`,
  `getPlatform()`, `__resetPlatformForTests()`, and the high-level `ipc.*`
  object the shell uses everywhere.

## The Platform seam

The shell reads `getPlatform()` lazily. Each runtime calls `setPlatform()`
once at boot:

- Desktop: `packages/desktop/src/renderer/index.tsx` →
  `setPlatform(createElectronPlatform())`
- Mobile (future): `packages/mobile/src/main.tsx` →
  `setPlatform(createCapacitorPlatform())`

Tests inject a mock via `setPlatform(buildMockPlatform({...}))` (helper in
`tests/setup.ts`). Legacy tests that assigned `window.etherpadDesktop` still
work — `tests/setup.ts` installs a property that routes those assignments
through `setPlatform()` for backwards compatibility.

## Conventions

- No imports from `electron`, `@capacitor/*`, or `window.etherpadDesktop`
  inside `src/`. All runtime calls go through `getPlatform()` / `ipc.*`.
- All user-facing strings via `t.<section>.<key>` from `src/i18n/`.
- Tests assert localized rendered strings, not implementation details.
- Sub-package internals use relative imports. `@shared/*` is a self-alias
  retained from the single-package days; new code should prefer relative
  paths or `@etherpad/shell/...` from outside the package.
