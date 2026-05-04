# AGENTS.md

Guidance for AI agents (Claude, Copilot, Cursor, etc.) working in this repo.

## TL;DR

- TypeScript strict end-to-end, React 18 + Zustand renderer, Electron 35 main.
- All persistent state lives in main-process stores; renderer talks to disk only via IPC.
- IPC payloads are Zod-validated; channels live in `src/shared/ipc/channels.ts`.
- Pad content runs in `WebContentsView`s isolated by per-workspace partitions.
- Tests are click-driven and outcome-asserting (no fluffy mounts).
- `pnpm test` (vitest), `pnpm test:e2e` (Playwright Electron), `pnpm package` (electron-builder).

## Dev loop

| Command | Purpose |
|---|---|
| `pnpm install` | Install deps. Uses pnpm; canonical version pinned in `packageManager`. |
| `pnpm dev` | electron-vite dev mode. Main + preload bundled, renderer served at :5173. |
| `pnpm typecheck` | `tsc -b` across all 4 leaf tsconfigs. Must exit 0. |
| `pnpm lint` | ESLint over `src/` + `tests/`. |
| `pnpm format` | Prettier write. |
| `pnpm test` | Vitest unit + component tests (single run). |
| `pnpm test:watch` | Vitest watch mode. |
| `pnpm test:e2e` | Playwright Electron E2E. Requires Etherpad on `:9003` (auto-spun by global setup). Auto-runs under `xvfb-run` when available so no windows steal focus. Set `E2E_NO_XVFB=1` to disable. |
| `pnpm build` | Production build → `out/main`, `out/preload`, `out/renderer`. |
| `pnpm package` | Build + electron-builder → AppImage + .deb under `release/`. |

After main-process source changes, **restart `pnpm dev`** — Vite HMR only covers the renderer. Main + preload changes need a full restart.

## Architecture

- **Main** (`src/main/`): app lifecycle, native menu, single-instance lock, stores, IPC handlers, BaseWindow + WebContentsView orchestration. Bundled to CJS (`out/main/index.cjs`).
- **Preload** (`src/preload/`): one file. `contextBridge.exposeInMainWorld('etherpadDesktop', api)`. Bundled to CJS.
- **Renderer** (`src/renderer/`): React + Zustand shell. Communicates with main only via the typed `etherpadDesktop` bridge.
- **Shared** (`src/shared/`): types + Zod schemas + IPC channel constants. Imported by all 3 contexts via the `@shared/*` alias.
- **Window model**: each app window is a `BaseWindow` containing one shell `WebContentsView` (the React UI) + N pad `WebContentsView`s (one per open tab). Pad views are positioned over the shell's "main area" rect by `TabManager`.
- **Visibility invariant** (`TabManager`): exactly one pad view is `setVisible(true)` at a time = the active tab. All others are `setVisible(false)`. When a dialog is open, all pad views are hidden so the dialog (which lives in the shell view's HTML) shows through.
- **Per-workspace partitions**: `partitionFor(workspaceId)` → `'persist:ws-${id}'`. Cookies, localStorage, IndexedDB are isolated per workspace.

## Conventions

- TypeScript strict; no `.js` files in source tree.
- All persistent state goes through main-process stores (`workspace-store`, `pad-history-store`, `settings-store`, `window-state-store`). Renderer NEVER touches disk.
- IPC payloads are Zod-validated in main via `wrapHandler(channel, schema, handler)`. Channels are constants in `src/shared/ipc/channels.ts` (`CH.WORKSPACE_LIST` etc.).
- Each `WebContentsView` is created via `pad-view-factory.ts` — single seam for future offline-cache / embedded-server work.
- E2E tests use port `9003` for the Etherpad fixture (NEVER `9001` — that's reserved for the user's ad-hoc local testing).
- Commits: conventional style (`feat(scope): …`, `fix(scope): …`, `test(e2e): …`, `docs(scope): …`).
- Push to `origin/feat/linux-mvp` after every fix or feature commit. Don't batch.

## House rules

- Match the spec at `docs/superpowers/specs/2026-05-03-etherpad-desktop-linux-mvp-design.md` and the plan at `docs/superpowers/plans/2026-05-03-etherpad-desktop-linux-mvp.md`.
- Never log pad content, pad names, or server URLs. Workspace IDs (UUIDs) are fine.
- Never use the name "etherpad-lite" in new code/packaging/docs — the project is "etherpad". Legacy URL refs in code (e.g. `github.com/ether/etherpad-lite` for upstream attribution) can stay.
- `i18n` for ALL user-facing strings. Desktop shell uses `t.<section>.<key>` in `src/renderer/i18n/`. Pad webview honours `?lang=<code>` URL params.

## Testing standards

The bar is **solid, not fluffy**:

- Tests must drive events (`userEvent.click`, `fireEvent.change`, `<page>.click()`), not state injection (state injection is fine for setting up preconditions, but not for the assertion path).
- Tests must assert behavioural outcomes — IPC calls with the right shape, store mutations, dialog dismissal, side effects. NOT just "heading exists."
- Every IPC handler has a happy-path test AND a failure-path test (invalid payload, missing entity, store error).
- Every event subscription in `App.tsx` has a renderer test that fires the event and asserts the resulting store/IPC reaction.
- Every menu item has both an IPC-level test (in `keyboard-shortcuts.spec.ts`) AND a real `Menu.getApplicationMenu().items[…].click()` test (in `menu-click.spec.ts`).
- Coverage audit at `docs/test-coverage-audit.md` — keep it current as new surface lands.

## Known gotchas (paid for in production-bug currency)

These are real bugs we've hit and fixed in this codebase. Keep them in mind:

1. **CSP must allow `'unsafe-eval'`** in dev so Vite HMR works. The shell renderer's CSP is in `src/renderer/index.html`. The relaxation only affects shell-bundled JS; pad content runs in separate `WebContentsView`s.

2. **`exactOptionalPropertyTypes: true`** mismatches with Zod's `.optional()` (which infers `T | undefined` rather than `T?`). Where this bites: `PadHistoryEntry.title?` vs `padHistoryEntrySchema.title.optional()` → cast at the boundary. See `src/main/pads/pad-history-store.ts`.

3. **Vitest 2.x** — `workspace` field on `defineConfig` is a PATH to a workspace file, not an inline array. Split is intentional: `vitest.config.ts` (base) + `vitest.workspace.ts` (project list).

4. **TypeScript composite projects** — leaf configs (`main`, `preload`, `renderer`) use `references: [{ path: './tsconfig.shared.json' }]` AND `paths: { '@shared/*': ['src/shared/*'] }`. Do NOT add `'src/shared/**'` to leaf `include` arrays — that double-compiles shared sources and corrupts cross-project type checking once shared has real types.

5. **`baseUrl: '.'` is required** in any tsconfig that uses non-relative `paths` patterns (TS5090).

6. **`electron-log/main` imports `electron` eagerly.** A test running in node-env Vitest can't load it. The logger module dynamic-imports it inside async `configureLogging`/`getLogger`, keeping the `redactForLog` pure-function export available for tests without electron present.

7. **Pure functions used by both lifecycle and tests must be in standalone files** that don't import `electron`. Example: `src/main/app/quit-state.ts` exports `serializeWindowsForQuit` so the test in `tests/main/app/lifecycle-quit.spec.ts` can import without triggering electron module load.

8. **Native menu accelerators are not deliverable via Playwright in xvfb/headless.** To test menu-fired actions, use either:
   - `app.evaluate(({ webContents }) => webContents.getAllWebContents().forEach(...))` to fire the IPC channel directly (faster but doesn't exercise the menu's click handler).
   - `app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.find(...).submenu.items.find(...).click())` to programmatically click the actual menu item (covers the `cb.<x>()` → `broadcastShell` path).
   We have BOTH in the suite (`keyboard-shortcuts.spec.ts` and `menu-click.spec.ts`).

9. **Pad views stack ON TOP of the shell view** in `BaseWindow.contentView` (later-added = on top). HTML rendered by the shell renderer (e.g. dialog overlays) cannot paint over a pad view. Solution: `setPadViewsHidden(true)` whenever `openDialog !== null`; `applyVisibility()` restores after.

10. **Tab visibility invariant** — exactly one pad view is `setVisible(true)` at a time = the active tab. `TabManager.applyVisibility()` is the single enforcer; every method that mutates state calls it.

11. **Renderer must subscribe to event broadcasts** to keep its store fresh. Main process only persists; the renderer has its own copy of state in Zustand and ONLY refreshes when it receives an `EV_*` event. Forget to subscribe → "Save doesn't save" symptoms.

12. **Pad URL must include `?lang=<code>`** to set Etherpad's pad UI language. Pure `webContents.reload()` does NOT pick up a setting change because the URL is unchanged. Use `webContents.loadURL(newUrl)` to apply language changes.

13. **Zustand selectors that build new arrays/objects per call** (e.g. `s => s.padHistory[wsId] ?? []`) cause infinite re-render loops. Use a stable empty-value sentinel: `const EMPTY: never[] = []`; return that instead of `[]` literals. Pattern in `PadSidebar.tsx` and `OpenPadDialog.tsx`.

14. **`window.etherpadDesktop` capture in `renderer/ipc/api.ts` is lazy** (a getter), so test mocks (`window.etherpadDesktop = {…}` in `beforeEach`) take effect on each call. Don't capture eagerly at module top.

15. **Quit must be defensive** — a window may already be destroyed when `before-quit` fires (user hit X). Use `serializeWindowsForQuit` which filters `!w.window.isDestroyed()` before serialising. The `closed` event on each `BaseWindow` calls `windowManager.forget(win)` so the manager drops stale refs without calling `.destroy()` again.

16. **CI: `pnpm/action-setup`** — do NOT pass `version:` when `package.json` has a `packageManager` field. pnpm-action-setup v4 errors on the conflict. Just `- uses: pnpm/action-setup@v4` with no `with:` block. The `packageManager` field is canonical.

17. **Menu item handlers without renderer wiring are dead.** When adding a `menu.<x>` IPC channel, also add the `if (k === 'menu.<x>') …` branch in `App.tsx`'s `onMenuShellMessage` callback. The menu-click E2E test catches this.

## Tests as documentation

When in doubt about a behaviour, search the test names — they describe the contract. `tests/e2e/*.spec.ts` are the user-flow contracts; `tests/renderer/*.spec.tsx` are the per-component contracts; `tests/main/*.spec.ts` are the per-module contracts.

## When changing surface area

If you add a new IPC channel, dialog, menu item, event, or component:
1. Add the implementation.
2. Add a unit test (vitest) that drives the new surface.
3. Add an E2E test (Playwright) if there's a user-visible flow.
4. Update `docs/test-coverage-audit.md` with the new surface entry.
5. Update this `AGENTS.md` if it introduces a new gotcha or convention.
6. Push.

## Pointers

- Spec: `docs/superpowers/specs/2026-05-03-etherpad-desktop-linux-mvp-design.md`
- Plan: `docs/superpowers/plans/2026-05-03-etherpad-desktop-linux-mvp.md`
- Coverage audit: `docs/test-coverage-audit.md`
- Manual smoke checklist: `docs/smoke-test.md`
