# Phase 2a — Extract `@etherpad/shell` (mechanical) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the renderer + shared source into a new `packages/shell` workspace package and introduce a `Platform` injection seam so `@etherpad/shell` no longer reads `window.etherpadDesktop` directly. Desktop wires a thin Electron adapter at boot. Zero behavioural change.

**Architecture:** `packages/shell` is a private, source-consumed workspace package. Imports inside shell stay relative; main/preload keep their `@shared/*` alias by remapping it to `packages/shell/src/*` so their imports survive unchanged. The seam is module-level injection (`setPlatform(impl)` called once at boot), not React context — preserves every existing `ipc.*` callsite. React-Context refactor is deferred to Phase 2b when mobile actually needs per-render injection.

**Tech Stack:** pnpm 10 workspaces, electron-vite 6, Vite 8 alias resolution, Vitest 4 projects mode, TypeScript 6 composite project refs.

---

## Decisions locked in before this plan

1. **`Platform` shape mirrors today's `ipc` API verbatim.** Same nine namespaces (`state`/`workspace`/`tab`/`window`/`padHistory`/`settings`/`httpLogin`/`updater`/`quickSwitcher`/`events`). Abstract sub-interfaces (`storage`/`padView`/`events`/etc.) from spec §4 are 2b.
2. **Module-level injection** via `setPlatform()` / `getPlatform()`. Not React context.
3. **Keep `@shared/*` alias** pointing at `packages/shell/src/` so `packages/desktop/src/{main,preload}` imports survive unchanged. Shell internals use relative imports.
4. **Shell ships as source.** `package.json` `"exports"` map points at `src/*.ts` / `src/*.tsx` / `src/styles/index.css`. No separate build step. Vite + tsc consume directly.
5. **Renderer tests move into `packages/shell/tests/`** with their own vitest project. Desktop's vitest keeps the `main` project only.
6. **E2E (Playwright Electron) stays in `packages/desktop/tests/e2e/`** unchanged — it boots the real bundled app.

---

## File structure after this plan

```
packages/
├── shell/                              # NEW — @etherpad/shell
│   ├── package.json                    # private, type=module, exports map
│   ├── tsconfig.json                   # extends desktop/tsconfig.base.json
│   ├── tsconfig.shell.json             # composite project for the lib
│   ├── tsconfig.tests.json             # composite for tests
│   ├── vitest.config.ts                # jsdom env, picks up tests/**/*.spec.tsx
│   ├── README.md                       # one-paragraph "what this package is"
│   ├── src/
│   │   ├── index.ts                    # barrel: App, setPlatform, Platform type
│   │   ├── App.tsx                     # MOVED from desktop renderer
│   │   ├── theme.ts                    # MOVED
│   │   ├── components/                 # MOVED
│   │   ├── dialogs/                    # MOVED (incl. fuzzy-match.ts)
│   │   ├── rail/                       # MOVED
│   │   ├── sidebar/                    # MOVED
│   │   ├── state/                      # MOVED
│   │   ├── tabs/                       # MOVED
│   │   ├── i18n/                       # MOVED (en.ts, index.ts)
│   │   ├── styles/                     # MOVED
│   │   ├── ipc/                        # MOVED from src/shared/ipc/
│   │   │   ├── channel-names.ts
│   │   │   └── channels.ts
│   │   ├── locales/                    # MOVED from src/shared/locales/
│   │   ├── types/                      # MOVED from src/shared/types/
│   │   ├── validation/                 # MOVED from src/shared/validation/
│   │   ├── url.ts                      # MOVED from src/shared/url.ts
│   │   └── platform/
│   │       └── ipc.ts                  # RELOCATED + REFACTORED from renderer/ipc/api.ts
│   │                                    #   Adds setPlatform()/getPlatform()
│   │                                    #   Exports Platform interface
│   └── tests/                          # MOVED from desktop/tests/renderer/
│       ├── setup.ts                    # calls setPlatform(mock) instead of window.etherpadDesktop=
│       ├── app-events.spec.tsx
│       ├── components/ dialogs/ i18n/ rail/ sidebar/ state/ tabs/
│
├── desktop/                            # unchanged except renderer entry
│   ├── package.json                    # add "@etherpad/shell": "workspace:*"
│   ├── electron.vite.config.ts         # @shared alias → ../shell/src
│   ├── vitest.config.ts                # drop "renderer" project; keep "main"
│   ├── tsconfig.{main,preload,shared,tests}.json
│   │                                    # @shared paths updated to ../shell/src
│   ├── tsconfig.renderer.json          # references shell; rootDir includes shell
│   ├── src/
│   │   ├── main/                       # UNCHANGED
│   │   ├── preload/                    # UNCHANGED
│   │   └── renderer/
│   │       ├── index.html              # KEEPS HERE — Vite entry
│   │       ├── index.tsx               # imports App + setPlatform from shell;
│   │       │                            #   constructs electron adapter; mounts
│   │       ├── global.d.ts             # KEEPS HERE — types window.etherpadDesktop
│   │       └── platform.electron.ts    # NEW — adapter implementing Platform
│   │                                    #   from window.etherpadDesktop
│   └── tests/                          # `renderer/` subtree DELETED; main/ + e2e/ stay
```

---

## Task 1: Scaffold `packages/shell` skeleton

**Files:**
- Create: `packages/shell/package.json`
- Create: `packages/shell/tsconfig.json`
- Create: `packages/shell/tsconfig.shell.json`
- Create: `packages/shell/tsconfig.tests.json`
- Create: `packages/shell/README.md`
- Create: `packages/shell/src/index.ts` (placeholder barrel)
- Create: `packages/shell/.gitignore`

- [ ] **Step 1: Create `packages/shell/package.json`**

```json
{
  "name": "@etherpad/shell",
  "private": true,
  "version": "0.0.0",
  "description": "Renderer-side shell shared between @etherpad/desktop and (soon) @etherpad/mobile.",
  "license": "Apache-2.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./platform": "./src/platform/ipc.ts",
    "./styles/index.css": "./src/styles/index.css",
    "./i18n": "./src/i18n/index.ts",
    "./state": "./src/state/store.ts"
  },
  "scripts": {
    "typecheck": "tsc -b --pretty",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src tests"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^4.0.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^6.0.1",
    "jsdom": "^29.1.1",
    "typescript": "^6.0.3",
    "vitest": "^4.1.5",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "zod": "^4.0.0",
    "zustand": "^5.0.13"
  }
}
```

- [ ] **Step 2: Create `packages/shell/tsconfig.json`**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.shell.json" },
    { "path": "./tsconfig.tests.json" }
  ]
}
```

- [ ] **Step 3: Create `packages/shell/tsconfig.shell.json`**

```json
{
  "extends": "../desktop/tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "out/shell",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "composite": true,
    "declaration": true,
    "noEmit": true,
    "tsBuildInfoFile": "out/shell/tsconfig.shell.tsbuildinfo"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

- [ ] **Step 4: Create `packages/shell/tsconfig.tests.json`**

```json
{
  "extends": "../desktop/tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "out/tests",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["node", "vitest/globals", "@testing-library/jest-dom"],
    "composite": true,
    "noEmit": true
  },
  "include": ["tests/**/*.ts", "tests/**/*.tsx"],
  "references": [{ "path": "./tsconfig.shell.json" }]
}
```

- [ ] **Step 5: Create `packages/shell/README.md`**

```markdown
# @etherpad/shell

React-based renderer shell shared between `@etherpad/desktop` (Electron) and `@etherpad/mobile` (Capacitor). Owns the workspaces / pads / tabs UI, Zustand state, i18n, and the `Platform` injection seam.

This package is consumed as source via pnpm workspace `workspace:*` — no separate build step. Imports resolve into `src/` directly.

Tests run with vitest jsdom and inject a mock `Platform` via `setPlatform()` in `tests/setup.ts`.
```

- [ ] **Step 6: Create `packages/shell/src/index.ts` (temporary placeholder barrel)**

```typescript
// Populated by subsequent tasks. Keeps `pnpm install` happy before the move.
export {};
```

- [ ] **Step 7: Create `packages/shell/.gitignore`**

```
node_modules
out
```

- [ ] **Step 8: Add `@etherpad/shell` as a workspace dep of `@etherpad/desktop`**

Edit `packages/desktop/package.json` — add to `dependencies`:

```json
    "@etherpad/shell": "workspace:*",
```

Place it alphabetically (between any existing alphabetical entries; before `electron-log`).

- [ ] **Step 9: Run `pnpm install` from repo root**

```bash
pnpm install
```

Expected: pnpm resolves the workspace link; `packages/desktop/node_modules/@etherpad/shell` becomes a symlink to `packages/shell`. No errors.

- [ ] **Step 10: Verify typecheck still passes**

```bash
pnpm typecheck
```

Expected: PASS. No imports reference shell yet, so this is a no-op sanity check.

- [ ] **Step 11: Commit**

```bash
git add packages/shell pnpm-lock.yaml packages/desktop/package.json
git commit -m "chore(shell): scaffold empty @etherpad/shell workspace package"
git push origin feat/mobile-phase2a-shell-extract
```

---

## Task 2: Move `src/shared/*` into `packages/shell/src/`

**Files:**
- Move: `packages/desktop/src/shared/ipc/` → `packages/shell/src/ipc/`
- Move: `packages/desktop/src/shared/locales/` → `packages/shell/src/locales/`
- Move: `packages/desktop/src/shared/types/` → `packages/shell/src/types/`
- Move: `packages/desktop/src/shared/validation/` → `packages/shell/src/validation/`
- Move: `packages/desktop/src/shared/url.ts` → `packages/shell/src/url.ts`
- Modify: `packages/desktop/electron.vite.config.ts` (aliases)
- Modify: `packages/desktop/vitest.config.ts` (aliases)
- Modify: `packages/desktop/tsconfig.shared.json` (drop — shell owns this code now)
- Modify: `packages/desktop/tsconfig.main.json`, `tsconfig.preload.json`, `tsconfig.renderer.json` (paths)
- Modify: `packages/desktop/tsconfig.json` (drop tsconfig.shared.json reference)

- [ ] **Step 1: git-mv shared subdirectories**

```bash
git mv packages/desktop/src/shared/ipc packages/shell/src/ipc
git mv packages/desktop/src/shared/locales packages/shell/src/locales
git mv packages/desktop/src/shared/types packages/shell/src/types
git mv packages/desktop/src/shared/validation packages/shell/src/validation
git mv packages/desktop/src/shared/url.ts packages/shell/src/url.ts
rmdir packages/desktop/src/shared
```

- [ ] **Step 2: Update electron-vite alias `@shared` to point at shell src**

Edit `packages/desktop/electron.vite.config.ts` — replace every `resolve('src/shared')` occurrence with `resolve('../shell/src')`. There are three: in `main.resolve.alias`, `preload.resolve.alias`, `renderer.resolve.alias`.

After edit, all three blocks should read:

```typescript
    resolve: {
      alias: { '@shared': resolve('../shell/src') },
    },
```

- [ ] **Step 3: Update vitest alias**

Edit `packages/desktop/vitest.config.ts` — change:

```typescript
const sharedResolve = {
  alias: { '@shared': resolve('src/shared') },
};
```

to:

```typescript
const sharedResolve = {
  alias: { '@shared': resolve('../shell/src') },
};
```

- [ ] **Step 4: Update tsconfig paths in main/preload/renderer**

Edit `packages/desktop/tsconfig.main.json`, `tsconfig.preload.json`, `tsconfig.renderer.json` — change every `"@shared/*": ["./src/shared/*"]` to `"@shared/*": ["../shell/src/*"]`.

- [ ] **Step 5: Delete the dead `tsconfig.shared.json`**

Shell now owns the code it described.

```bash
git rm packages/desktop/tsconfig.shared.json
```

Edit `packages/desktop/tsconfig.json` — remove the `tsconfig.shared.json` entry from `references`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.main.json" },
    { "path": "./tsconfig.preload.json" },
    { "path": "./tsconfig.renderer.json" },
    { "path": "./tsconfig.tests.json" }
  ]
}
```

- [ ] **Step 6: Update main/preload/renderer tsconfig references**

The three configs currently reference `./tsconfig.shared.json`. Edit each to reference `../shell/tsconfig.shell.json` instead.

`packages/desktop/tsconfig.main.json` `references`:

```json
  "references": [{ "path": "../shell/tsconfig.shell.json" }]
```

Same for `tsconfig.preload.json` and `tsconfig.renderer.json`.

- [ ] **Step 7: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS. `@shared/*` imports from main/preload/renderer now resolve into `packages/shell/src/`.

- [ ] **Step 8: Run desktop tests**

```bash
pnpm test
```

Expected: both `main` and `renderer` vitest projects PASS. Renderer tests still find `@shared/...` via the updated alias.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(shell): move src/shared into packages/shell/src"
git push
```

---

## Task 3: Move renderer code into `packages/shell/src/`

**Files:**
- Move: `packages/desktop/src/renderer/App.tsx` → `packages/shell/src/App.tsx`
- Move: `packages/desktop/src/renderer/theme.ts` → `packages/shell/src/theme.ts`
- Move: `packages/desktop/src/renderer/{components,dialogs,rail,sidebar,state,tabs,i18n,styles}/` → `packages/shell/src/`
- Keep in desktop: `index.html`, `index.tsx`, `global.d.ts`, `ipc/api.ts`
- Modify: `packages/desktop/electron.vite.config.ts` (renderer root + html input)
- Modify: `packages/desktop/tsconfig.renderer.json` (include shell src/tests as well? — see steps)

- [ ] **Step 1: git-mv renderer directories and files**

```bash
git mv packages/desktop/src/renderer/components packages/shell/src/components
git mv packages/desktop/src/renderer/dialogs packages/shell/src/dialogs
git mv packages/desktop/src/renderer/rail packages/shell/src/rail
git mv packages/desktop/src/renderer/sidebar packages/shell/src/sidebar
git mv packages/desktop/src/renderer/state packages/shell/src/state
git mv packages/desktop/src/renderer/tabs packages/shell/src/tabs
git mv packages/desktop/src/renderer/i18n packages/shell/src/i18n
git mv packages/desktop/src/renderer/styles packages/shell/src/styles
git mv packages/desktop/src/renderer/App.tsx packages/shell/src/App.tsx
git mv packages/desktop/src/renderer/theme.ts packages/shell/src/theme.ts
```

- [ ] **Step 2: Update Vite renderer entry HTML**

`packages/desktop/src/renderer/index.html` stays put. It references `./index.tsx` which stays in desktop. But the `<link rel="stylesheet">` (if any) needs review — open the file:

```bash
cat packages/desktop/src/renderer/index.html
```

If it imports CSS via a `<link>` tag pointing at the moved `styles/`, update it to point at the bundled output. Most likely it doesn't — CSS is imported from `index.tsx` instead. Confirm with grep:

```bash
grep -l "styles/index.css" packages/desktop/src/renderer/
```

- [ ] **Step 3: Update desktop `index.tsx` to import App + CSS from shell**

Edit `packages/desktop/src/renderer/index.tsx` — replace the `App` import and CSS import. Final form:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@etherpad/shell';
import '@etherpad/shell/styles/index.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

(Adapter wire-up `setPlatform(...)` is added in Task 6.)

- [ ] **Step 4: Update shell barrel `src/index.ts`**

Replace the placeholder content of `packages/shell/src/index.ts`:

```typescript
export { App } from './App.js';
```

(More exports added in Tasks 5 and 6.)

- [ ] **Step 5: Update renderer tsconfig to include shell**

Edit `packages/desktop/tsconfig.renderer.json` — the `App.tsx` source now lives in shell, but the renderer entry (`index.tsx`) still lives in desktop. The renderer tsconfig only needs to compile desktop's renderer files; shell's tsconfig handles its own.

So `tsconfig.renderer.json` `include` stays `["src/renderer/**/*.ts", "src/renderer/**/*.tsx"]`. But it must `reference` the shell project so TS knows where `@etherpad/shell` resolves:

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "out/renderer",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["vite/client"],
    "composite": true,
    "noEmit": true,
    "paths": {
      "@shared/*": ["../shell/src/*"]
    }
  },
  "include": ["src/renderer/**/*.ts", "src/renderer/**/*.tsx"],
  "references": [{ "path": "../shell/tsconfig.shell.json" }]
}
```

- [ ] **Step 6: Verify build works**

```bash
pnpm build
```

Expected: electron-vite compiles main + preload + renderer successfully. The renderer bundle imports `App` from `@etherpad/shell` (resolved via the workspace symlink + Vite's automatic source-map import).

- [ ] **Step 7: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS. Shell typechecks via its own tsconfig.shell.json (called via composite project refs). Desktop renderer typechecks its `index.tsx`.

- [ ] **Step 8: Tests will fail at this step — that's expected**

```bash
pnpm test
```

Expected: the `renderer` vitest project FAILS because its tests still live at `packages/desktop/tests/renderer/` and import from paths that no longer exist. Task 7 moves them. For now, document the failure and move on.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(shell): move renderer code into packages/shell/src"
git push
```

---

## Task 4: Wire eslint + prettier to lint shell too

**Files:**
- Modify: `packages/desktop/eslint.config.js` (extend or duplicate for shell? — see step 1)
- Decide: hoist `eslint.config.js` to repo root or add `packages/shell/eslint.config.js`

- [ ] **Step 1: Inspect current eslint config**

```bash
cat packages/desktop/eslint.config.js
```

Decision: copy the same config into `packages/shell/eslint.config.js` (simplest, no root-hoisting churn). Imports of `globals`, `eslint-plugin-react`, etc. resolve via desktop's `node_modules` (pnpm hoists shared deps; or shell can declare these as devDeps).

- [ ] **Step 2: Create `packages/shell/eslint.config.js` as a copy**

```bash
cp packages/desktop/eslint.config.js packages/shell/eslint.config.js
```

- [ ] **Step 3: Adjust paths inside shell's eslint config**

Open `packages/shell/eslint.config.js` and update any `tsconfigRootDir` / `project` references from `./tsconfig.renderer.json` (or whatever desktop uses) to `./tsconfig.shell.json` / `./tsconfig.tests.json`. Update `files` globs if they hardcode `src/main` etc.

- [ ] **Step 4: Add required devDeps to shell**

Run:

```bash
pnpm --filter @etherpad/shell add -D \
  @eslint/js \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser \
  eslint \
  eslint-config-prettier \
  eslint-plugin-react \
  eslint-plugin-react-hooks \
  globals \
  prettier \
  typescript-eslint
```

(Versions auto-pinned to whatever's in desktop. If pnpm warns about mismatches, copy versions explicitly from `packages/desktop/package.json`.)

- [ ] **Step 5: Verify lint runs in shell**

```bash
pnpm --filter @etherpad/shell lint
```

Expected: PASS (or surfaces real lint issues introduced by the move — fix if any).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(shell): add eslint config + devDeps"
git push
```

---

## Task 5: Introduce `Platform` type + `setPlatform()` seam

**Files:**
- Create: `packages/shell/src/platform/ipc.ts` (relocated from `packages/desktop/src/renderer/ipc/api.ts`)
- Delete: `packages/desktop/src/renderer/ipc/api.ts` (move source)
- Delete: `packages/desktop/src/renderer/ipc/` if empty after move
- Modify: every shell file that previously `import { ipc } from './ipc/api.js'` to import from `../platform/ipc.js` instead (relative depth varies)
- Modify: `packages/shell/src/index.ts` (export `setPlatform`, `Platform` type)

- [ ] **Step 1: Move `ipc/api.ts` into shell as `platform/ipc.ts`**

```bash
mkdir -p packages/shell/src/platform
git mv packages/desktop/src/renderer/ipc/api.ts packages/shell/src/platform/ipc.ts
rmdir packages/desktop/src/renderer/ipc
```

- [ ] **Step 2: Refactor `platform/ipc.ts` to use injected platform**

Replace contents of `packages/shell/src/platform/ipc.ts` with:

```typescript
import type { IpcResult, InitialState, Workspace } from '../ipc/channels.js';
import { AppError } from '../types/errors.js';

/**
 * The shape of the runtime adapter the shell needs. Desktop's
 * `window.etherpadDesktop` already matches this verbatim. Mobile (Phase 3)
 * will implement the same surface over Capacitor.
 *
 * Phase 2a is a mechanical relocation: the surface mirrors the existing
 * preload API exactly. Phase 2b will refactor toward the abstract
 * `storage`/`padView`/`events` sub-interfaces from spec §4 once mobile
 * has a real implementation driving the shape.
 */
export interface Platform {
  state: {
    getInitial(): Promise<unknown>;
  };
  workspace: {
    list(): Promise<unknown>;
    add(input: { name: string; serverUrl?: string; color: string; kind?: 'remote' | 'embedded' }): Promise<unknown>;
    update(input: { id: string; name?: string; serverUrl?: string; color?: string }): Promise<unknown>;
    remove(input: { id: string }): Promise<unknown>;
    reorder(input: { order: string[] }): Promise<unknown>;
  };
  tab: {
    open(input: { workspaceId: string; padName: string; mode?: 'open' | 'create' }): Promise<unknown>;
    close(input: { tabId: string }): Promise<unknown>;
    focus(input: { tabId: string }): Promise<unknown>;
    reload(input: { tabId: string }): Promise<unknown>;
    hardReload(input: { tabId: string }): Promise<unknown>;
  };
  window: {
    setActiveWorkspace(input: { workspaceId: string | null }): Promise<unknown>;
    reloadShell(): Promise<unknown>;
    setPadViewsHidden(hidden: boolean): Promise<unknown>;
    setRailCollapsed(collapsed: boolean): Promise<unknown>;
  };
  padHistory: {
    list(input: { workspaceId: string }): Promise<unknown>;
    pin(input: { workspaceId: string; padName: string }): Promise<unknown>;
    unpin(input: { workspaceId: string; padName: string }): Promise<unknown>;
    clearRecent(input: { workspaceId: string }): Promise<unknown>;
    clearAll(): Promise<unknown>;
  };
  settings: {
    get(): Promise<unknown>;
    update(patch: Record<string, unknown>): Promise<unknown>;
  };
  httpLogin: {
    respond(input: { requestId: string; cancel?: boolean; username?: string; password?: string }): Promise<unknown>;
  };
  updater: {
    checkNow(): Promise<unknown>;
    installAndRestart(): Promise<unknown>;
    getState(): Promise<unknown>;
  };
  quickSwitcher: {
    searchPadContent(input: { query: string }): Promise<unknown>;
  };
  events: {
    onWorkspacesChanged(l: (p: unknown) => void): () => void;
    onPadHistoryChanged(l: (p: unknown) => void): () => void;
    onTabsChanged(l: (p: unknown) => void): () => void;
    onTabState(l: (p: unknown) => void): () => void;
    onSettingsChanged(l: (p: unknown) => void): () => void;
    onHttpLoginRequest(l: (p: unknown) => void): () => void;
    onUpdaterState(l: (p: unknown) => void): () => void;
    onPadFastSwitch(l: (p: { key: string }) => void): () => void;
    onMenuShellMessage(l: (p: unknown) => void): () => void;
  };
  /** Optional surface for runtime-specific test seams. Shell code MUST NOT depend on this. */
  e2eFlags?: { enabled: boolean };
}

let injected: Platform | null = null;

export function setPlatform(p: Platform): void {
  injected = p;
}

export function getPlatform(): Platform {
  if (!injected) {
    throw new Error('[@etherpad/shell] setPlatform() must be called before any IPC. ' +
      'Desktop calls it in renderer/index.tsx; mobile calls it in src/main.tsx.');
  }
  return injected;
}

/** Test-only: clear the injected platform between tests. */
export function __resetPlatformForTests(): void {
  injected = null;
}

const api = () => getPlatform();

async function unwrap<T>(p: Promise<IpcResult<T> | unknown>): Promise<T> {
  const r = (await p) as IpcResult<T>;
  if (r && typeof r === 'object' && 'ok' in r) {
    if (r.ok) return r.value;
    throw new AppError(r.error.kind, r.error.message);
  }
  return r as T;
}

export const ipc = {
  state: {
    getInitial: () => unwrap<InitialState>(api().state.getInitial() as never),
  },
  workspace: {
    list: () => unwrap<{ workspaces: Workspace[]; order: string[] }>(api().workspace.list() as never),
    add: (input: { name: string; serverUrl?: string; color: string; kind?: 'remote' | 'embedded' }) =>
      unwrap<Workspace>(api().workspace.add(input) as never),
    update: (input: { id: string; name?: string; serverUrl?: string; color?: string }) =>
      unwrap<Workspace>(api().workspace.update(input) as never),
    remove: (input: { id: string }) => unwrap<{ ok: true }>(api().workspace.remove(input) as never),
    reorder: (input: { order: string[] }) => unwrap<string[]>(api().workspace.reorder(input) as never),
  },
  tab: {
    open: (input: { workspaceId: string; padName: string; mode?: 'open' | 'create' }) =>
      unwrap<{ tabId: string; workspaceId: string; padName: string; title: string; state: string }>(
        api().tab.open(input) as never,
      ),
    close: (input: { tabId: string }) => unwrap<{ ok: true }>(api().tab.close(input) as never),
    focus: (input: { tabId: string }) => unwrap<{ ok: true }>(api().tab.focus(input) as never),
    reload: (input: { tabId: string }) => unwrap<{ ok: true }>(api().tab.reload(input) as never),
    hardReload: (input: { tabId: string }) => unwrap<{ ok: true }>(api().tab.hardReload(input) as never),
  },
  window: {
    setActiveWorkspace: (workspaceId: string | null) =>
      unwrap<{ ok: true }>(api().window.setActiveWorkspace({ workspaceId }) as never),
    reloadShell: () => unwrap<{ ok: true }>(api().window.reloadShell() as never),
    setPadViewsHidden: (hidden: boolean) =>
      unwrap<{ ok: true }>(api().window.setPadViewsHidden(hidden) as never),
    setRailCollapsed: (collapsed: boolean) =>
      unwrap<{ ok: true }>(api().window.setRailCollapsed(collapsed) as never),
  },
  padHistory: {
    list: (workspaceId: string) =>
      unwrap<Array<{ workspaceId: string; padName: string; lastOpenedAt: number; pinned: boolean; title?: string }>>(
        api().padHistory.list({ workspaceId }) as never,
      ),
    pin: (workspaceId: string, padName: string) =>
      unwrap<{ ok: true }>(api().padHistory.pin({ workspaceId, padName }) as never),
    unpin: (workspaceId: string, padName: string) =>
      unwrap<{ ok: true }>(api().padHistory.unpin({ workspaceId, padName }) as never),
    clearRecent: (workspaceId: string) =>
      unwrap<{ ok: true }>(api().padHistory.clearRecent({ workspaceId }) as never),
    clearAll: () => unwrap<{ ok: true }>(api().padHistory.clearAll() as never),
  },
  settings: {
    get: () => unwrap(api().settings.get() as never),
    update: (patch: Record<string, unknown>) => unwrap(api().settings.update(patch) as never),
  },
  httpLogin: {
    respond: (input: { requestId: string; cancel?: boolean; username?: string; password?: string }) =>
      unwrap<{ ok: true }>(api().httpLogin.respond(input) as never),
  },
  updater: {
    checkNow: () => unwrap<{ ok: true }>(api().updater.checkNow() as never),
    installAndRestart: () => unwrap<{ ok: true }>(api().updater.installAndRestart() as never),
    getState: () => api().updater.getState() as Promise<unknown>,
  },
  quickSwitcher: {
    searchPadContent: (query: string) =>
      api().quickSwitcher.searchPadContent({ query }) as Promise<
        Array<{ workspaceId: string; padName: string; snippet: string }>
      >,
  },
  get events() {
    return api().events;
  },
};
```

Key changes from the original `renderer/ipc/api.ts`:
- `const api = () => window.etherpadDesktop` becomes `const api = () => getPlatform()`.
- Added `Platform` interface, `setPlatform()`, `getPlatform()`, `__resetPlatformForTests()`.
- Import paths updated from `@shared/...` to relative `../ipc/...` / `../types/...` (since this file now lives in `packages/shell/src/platform/`, the `@shared` alias still works but relative is cleaner for shell internals).

- [ ] **Step 3: Update every shell-internal import of `ipc`**

Find all callers within shell:

```bash
grep -rln --include="*.ts" --include="*.tsx" "from '\.\./ipc/api\|from '\./ipc/api" packages/shell/src
```

Expected matches (post-move): App.tsx, dialogs/*.tsx, components/{TabErrorOverlay,UpdaterBanner}.tsx, rail/WorkspaceRail.tsx, sidebar/PadSidebar.tsx, tabs/TabStrip.tsx.

Replace each `from './ipc/api.js'` or `from '../ipc/api.js'` with the correct relative path to `./platform/ipc.js`. Concrete examples:

- `packages/shell/src/App.tsx`: `import { ipc } from './ipc/api.js'` → `import { ipc } from './platform/ipc.js'`
- `packages/shell/src/dialogs/AddWorkspaceDialog.tsx`: `import { ipc } from '../ipc/api.js'` → `import { ipc } from '../platform/ipc.js'`
- Same for every other dialog/component/rail/sidebar/tabs file.

- [ ] **Step 4: Also update the `e2eFlags` check in App.tsx**

App.tsx currently reads `window.etherpadDesktop?.e2eFlags?.enabled` at module scope. Refactor to read from the platform — but lazily, since the platform isn't injected at module load.

Move the entire block from module-scope into a `useEffect` inside `App()`:

```tsx
useEffect(() => {
  const p = (typeof window !== 'undefined' ? (window as any).etherpadDesktop : undefined) as
    | { e2eFlags?: { enabled: boolean } }
    | undefined;
  if (!p?.e2eFlags?.enabled) return;
  (window as any).__test_useShellStore = useShellStore;
  (window as any).__test_dialogActions = {
    openHttpAuth: (requestId: string, url: string) =>
      dialogActions.openDialog('httpAuth', { requestId, url }),
    openRemoveWorkspace: (name: string) => {
      const ws = useShellStore.getState().workspaces.find((w) => w.name === name);
      if (ws) dialogActions.openDialog('removeWorkspace', { workspaceId: ws.id });
    },
  };
}, []);
```

Rationale: `window.etherpadDesktop` is desktop-specific; shell shouldn't read it at module-level. The e2e seam is desktop-only by design, so reading the global is OK — but only at runtime, not module load. (Phase 2b will move the e2e seam fully into desktop's index.tsx.)

- [ ] **Step 5: Export `setPlatform` and `Platform` from shell barrel**

Edit `packages/shell/src/index.ts`:

```typescript
export { App } from './App.js';
export { setPlatform, getPlatform, __resetPlatformForTests, type Platform } from './platform/ipc.js';
```

- [ ] **Step 6: Typecheck — expect failures**

```bash
pnpm typecheck
```

Expected: typecheck FAILS because no platform is injected yet and the desktop renderer entry still has the old import. Task 6 fixes it.

That said, shell-internal typecheck should pass — only the desktop renderer's `index.tsx` should break because it now needs `setPlatform`. If shell-internal errors appear, fix them before moving on (likely import path typos from Step 3).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(shell): introduce Platform type + setPlatform seam"
git push
```

---

## Task 6: Implement Electron `Platform` adapter and wire desktop boot

**Files:**
- Create: `packages/desktop/src/renderer/platform.electron.ts`
- Modify: `packages/desktop/src/renderer/index.tsx`

- [ ] **Step 1: Create `packages/desktop/src/renderer/platform.electron.ts`**

```typescript
import type { Platform } from '@etherpad/shell';

/**
 * Adapter that exposes the preload-injected `window.etherpadDesktop` as a
 * `Platform` instance. The shapes are structurally identical (preload's
 * `EtherpadDesktopApi` was the original source-of-truth and `Platform`
 * is a verbatim rename); this function exists to make the boundary explicit
 * and to give a single place to add desktop-specific shimming later.
 */
export function createElectronPlatform(): Platform {
  if (typeof window === 'undefined' || !window.etherpadDesktop) {
    throw new Error('window.etherpadDesktop is missing — preload did not expose it.');
  }
  // window.etherpadDesktop is typed as EtherpadDesktopApi (from preload/index.ts).
  // It is structurally compatible with Platform. The cast is intentional and safe.
  return window.etherpadDesktop as unknown as Platform;
}
```

- [ ] **Step 2: Update desktop's `index.tsx` to inject the adapter**

Replace `packages/desktop/src/renderer/index.tsx` with:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App, setPlatform } from '@etherpad/shell';
import '@etherpad/shell/styles/index.css';
import { createElectronPlatform } from './platform.electron.js';

// Wire the platform adapter before App renders. App and every IPC caller
// inside @etherpad/shell read the injected platform via getPlatform().
setPlatform(createElectronPlatform());

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: PASS. Shell's `Platform` and preload's `EtherpadDesktopApi` are structurally identical.

- [ ] **Step 4: Build**

```bash
pnpm build
```

Expected: PASS. electron-vite bundles renderer with `App` imported from shell.

- [ ] **Step 5: Launch desktop dev mode and verify the shell renders**

```bash
pnpm dev
```

Expected: the Electron window opens and behaves identically to before — workspaces list, tabs, dialogs all work. Close the window once verified.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(desktop): wire createElectronPlatform adapter at renderer boot"
git push
```

---

## Task 7: Move renderer tests into `packages/shell/tests/`

**Files:**
- Move: `packages/desktop/tests/renderer/**` → `packages/shell/tests/**`
- Modify: `packages/shell/tests/setup.ts` (call `setPlatform(mock)` instead of mutating `window`)
- Create: `packages/shell/vitest.config.ts`
- Modify: `packages/desktop/vitest.config.ts` (drop the `renderer` project)

- [ ] **Step 1: git-mv the entire renderer test subtree**

```bash
git mv packages/desktop/tests/renderer packages/shell/tests
```

- [ ] **Step 2: Rewrite `packages/shell/tests/setup.ts`**

Replace contents with:

```typescript
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { __resetPlatformForTests, setPlatform, type Platform } from '../src/platform/ipc.js';

/**
 * Default mock platform — every method resolves to `{ ok: true }`.
 * Individual tests can override by calling `setPlatform(buildMockPlatform({ ... }))`
 * in `beforeEach`.
 */
const noop = vi.fn().mockResolvedValue({ ok: true });
const noopUnsubscribe = vi.fn(() => () => {});

export function buildMockPlatform(overrides: Partial<Platform> = {}): Platform {
  const base = {
    state: { getInitial: noop },
    workspace: { list: noop, add: noop, update: noop, remove: noop, reorder: noop },
    tab: { open: noop, close: noop, focus: noop, reload: noop, hardReload: noop },
    window: {
      setActiveWorkspace: noop,
      reloadShell: noop,
      setPadViewsHidden: noop,
      setRailCollapsed: noop,
    },
    padHistory: { list: noop, pin: noop, unpin: noop, clearRecent: noop, clearAll: noop },
    settings: { get: noop, update: noop },
    httpLogin: { respond: noop },
    updater: { checkNow: noop, installAndRestart: noop, getState: noop },
    quickSwitcher: { searchPadContent: noop },
    events: {
      onWorkspacesChanged: noopUnsubscribe,
      onPadHistoryChanged: noopUnsubscribe,
      onTabsChanged: noopUnsubscribe,
      onTabState: noopUnsubscribe,
      onSettingsChanged: noopUnsubscribe,
      onHttpLoginRequest: noopUnsubscribe,
      onUpdaterState: noopUnsubscribe,
      onPadFastSwitch: noopUnsubscribe,
      onMenuShellMessage: noopUnsubscribe,
    },
  } as unknown as Platform;
  return { ...base, ...overrides };
}

setPlatform(buildMockPlatform());

afterEach(() => {
  __resetPlatformForTests();
  setPlatform(buildMockPlatform());
});
```

- [ ] **Step 3: Update tests that previously stubbed `window.etherpadDesktop`**

Find any test files that do `window.etherpadDesktop = ...` or `Object.defineProperty(window, 'etherpadDesktop', ...)`:

```bash
grep -rln "etherpadDesktop" packages/shell/tests
```

For each match, replace the window mutation with `setPlatform(buildMockPlatform({ ...overrides }))`. The `buildMockPlatform` helper is exported from `tests/setup.ts`.

- [ ] **Step 4: Create `packages/shell/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.spec.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
  },
});
```

- [ ] **Step 5: Drop the `renderer` project from desktop's vitest config**

Edit `packages/desktop/vitest.config.ts` — remove the `renderer` entry from `projects`. Final form:

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const sharedResolve = {
  alias: { '@shared': resolve('../shell/src') },
};

export default defineConfig({
  resolve: sharedResolve,
  test: {
    globals: true,
    projects: [
      {
        resolve: sharedResolve,
        test: {
          name: 'main',
          globals: true,
          environment: 'node',
          include: ['tests/main/**/*.spec.ts'],
        },
      },
    ],
  },
});
```

(Drop the `@vitejs/plugin-react` import at the top — it's only used by the `renderer` project.)

- [ ] **Step 6: Run shell tests**

```bash
pnpm --filter @etherpad/shell test
```

Expected: all renderer-level tests pass under the shell project, using the injected mock platform.

If specific tests fail, the typical cause is a per-test mock that needs migrating from `window.etherpadDesktop` to `setPlatform()`. Fix each in place.

- [ ] **Step 7: Run desktop tests**

```bash
pnpm --filter @etherpad/desktop test
```

Expected: PASS. Only the `main` vitest project runs; renderer tests now live in shell.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "test(shell): move renderer tests into packages/shell/tests with injected mock platform"
git push
```

---

## Task 8: Update root scripts and CI to run shell tests

**Files:**
- Modify: root `package.json` (test/typecheck/lint proxies)
- Modify: `.github/workflows/ci.yml` (run shell tests + typecheck)

- [ ] **Step 1: Update root `package.json` test/typecheck/lint scripts**

Replace these three scripts in root `package.json`:

```json
    "typecheck": "pnpm -r --workspace-concurrency=1 typecheck",
    "lint": "pnpm -r --workspace-concurrency=1 lint",
    "test": "pnpm -r --workspace-concurrency=1 test",
```

(`-r` recurses across workspaces; `--workspace-concurrency=1` prevents parallel runs that can interleave output and confuse log-following.)

- [ ] **Step 2: Verify root scripts run both packages**

```bash
pnpm typecheck
```

Expected: typechecks shell + desktop. Both PASS.

```bash
pnpm test
```

Expected: runs shell vitest + desktop vitest (main project only). All PASS.

```bash
pnpm lint
```

Expected: lints shell + desktop. PASS.

- [ ] **Step 3: Inspect existing CI workflow**

```bash
cat .github/workflows/ci.yml
```

Identify steps that run `pnpm test`, `pnpm typecheck`, `pnpm lint`. They should now naturally cover both packages via the updated root scripts.

If any step uses `pnpm --filter @etherpad/desktop test`, change it to plain `pnpm test` so both packages run. If a step hard-codes `packages/desktop/...` paths for vitest reports, update to a glob or run per-package.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "ci: run shell + desktop tests via recursive workspace scripts"
git push
```

---

## Task 9: Refresh docs

**Files:**
- Modify: `CLAUDE.md` (root) — Monorepo layout section
- Modify: `packages/desktop/AGENTS.md` — pointer to shell for renderer code
- Modify: `README.md` (root) — mention `packages/shell`
- Create: `packages/shell/AGENTS.md` — short orientation doc

- [ ] **Step 1: Update root `CLAUDE.md` Monorepo layout section**

Edit the "Monorepo layout" section to add `packages/shell`:

```markdown
## Monorepo layout (read this first)

This repo is a pnpm workspace. Source lives under `packages/`:

- `packages/shell` (`@etherpad/shell`) — React renderer shell, Zustand state,
  i18n, types, validation, IPC channel names, the `Platform` injection seam.
  Consumed as source by `packages/desktop` and (soon) `packages/mobile`.
- `packages/desktop` (`@etherpad/desktop`) — Electron main + preload + the
  renderer entry that injects `createElectronPlatform()` and mounts the shell.

Run every `pnpm` command from the repo root. `pnpm test`, `pnpm typecheck`,
and `pnpm lint` recurse across both packages.

Mobile (`packages/mobile`) lands in a later phase.
```

- [ ] **Step 2: Update `packages/desktop/AGENTS.md`**

Find the "Project Overview" / "Stack" section and add a note that the renderer code now lives in `packages/shell`. Most existing path references (`src/renderer/...`) will need to be updated to `packages/shell/src/...`. Do a careful sweep:

```bash
grep -n "src/renderer\|src/shared" packages/desktop/AGENTS.md
```

For each match, decide: does it refer to the desktop renderer entry (`src/renderer/index.tsx`, `src/renderer/platform.electron.ts`, `src/renderer/global.d.ts` — keep), or to moved shell code (update to `packages/shell/src/...`)?

- [ ] **Step 3: Create `packages/shell/AGENTS.md`**

Short orientation doc:

```markdown
# Shell — agent orientation

This is the renderer shell shared by desktop and mobile. Owns:

- `App.tsx`, `components/`, `dialogs/`, `rail/`, `sidebar/`, `tabs/`, `state/`,
  `i18n/`, `styles/`, `theme.ts`
- `ipc/` — typed channel names and result types (no Electron-IPC runtime)
- `types/`, `validation/` — Zod schemas and TS types for cross-runtime payloads
- `platform/ipc.ts` — the `Platform` interface, `setPlatform()`, `getPlatform()`,
  and the high-level `ipc.*` object the shell uses everywhere.

## The Platform seam

The shell reads `getPlatform()` lazily. Each runtime calls `setPlatform()` once
at boot:

- Desktop: `packages/desktop/src/renderer/index.tsx` →
  `setPlatform(createElectronPlatform())`
- Mobile (future): `packages/mobile/src/main.tsx` →
  `setPlatform(createCapacitorPlatform())`

Tests inject a mock via `setPlatform(buildMockPlatform({...}))` (helper in
`tests/setup.ts`).

## Conventions

- No imports from `electron`, `@capacitor/*`, or `window.etherpadDesktop`.
  All runtime calls go through `getPlatform()` / `ipc.*`.
- All user-facing strings via `t.<section>.<key>` from `src/i18n/`.
- Tests assert localized rendered strings, not implementation details.
```

- [ ] **Step 4: Update root `README.md`**

Find the section that describes the layout and add `packages/shell` alongside `packages/desktop`. Keep the wording concise.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs(shell): refresh CLAUDE.md, AGENTS.md, README for new package"
git push
```

---

## Task 10: Open PR, monitor CI, address Qodo feedback

**Files:** none — process step.

- [ ] **Step 1: Open the PR**

```bash
gh pr create --base main --head feat/mobile-phase2a-shell-extract \
  --title "refactor(shell): extract @etherpad/shell + Platform injection seam (Phase 2a)" \
  --body "$(cat <<'EOF'
## Summary

Phase 2a of the mobile rollout (spec §11.2, plan
`docs/superpowers/plans/2026-05-11-etherpad-mobile-phase2a-shell-extract.md`):

- New workspace package `@etherpad/shell` containing the renderer code
  (`App.tsx`, components, dialogs, rail, sidebar, state, tabs, i18n, styles)
  and the previously-shared modules (`ipc`, `types`, `validation`, `locales`,
  `url.ts`).
- New `Platform` interface and `setPlatform()` / `getPlatform()` seam in
  `packages/shell/src/platform/ipc.ts`. Mirrors today's preload API verbatim.
- `packages/desktop/src/renderer/index.tsx` wires a thin
  `createElectronPlatform()` adapter at boot before mounting the shell `<App />`.
- Renderer tests moved into `packages/shell/tests/` with their own vitest
  config + an injected mock platform (no more `window.etherpadDesktop`
  mutation).
- Root `pnpm typecheck` / `test` / `lint` recurse across both packages.

Zero behavioural change — the e2e suite and renderer unit tests cover the
seam swap. The abstract `Platform` redesign (`storage` / `padView` / `events`
sub-interfaces from spec §4) is Phase 2b, scheduled to land alongside the
mobile package so the shape is informed by a second consumer.

## Test plan

- [ ] `pnpm typecheck` green (both packages, composite project refs)
- [ ] `pnpm test` green (`@etherpad/shell` vitest + `@etherpad/desktop` main project)
- [ ] `pnpm test:e2e` green (Playwright Electron, unchanged)
- [ ] `pnpm dev` opens the Electron window and the shell renders identically
- [ ] `pnpm build` produces a working bundle
- [ ] No imports of `electron`, `@capacitor/*`, or `window.etherpadDesktop` inside `packages/shell/src/` (audit)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Wait ~20s and check CI**

```bash
sleep 20 && gh pr checks <PR#>
```

If any check is failing, read the failure and fix in this branch before moving on. Per the user's standing rule, don't open new tasks while CI is red on this PR.

- [ ] **Step 3: Wait for Qodo's review (if available)**

```bash
gh pr view <PR#> --comments | head -200
```

For every Qodo comment: either fix the issue and reply, or reply with the reasoning why it's not actionable. Do not wait for the user to triage — that's the standing rule for Qodo feedback.

- [ ] **Step 4: Merge**

When CI green and Qodo addressed:

```bash
gh pr merge <PR#> --squash --auto
```

(or wait for the user to merge if they prefer.)

- [ ] **Step 5: Update memory after merge**

Update `~/.claude/projects/-home-jose-etherpad/memory/project_mobile_rollout_campaign.md` to mark Phase 2 status: 2a complete, 2b pending.

---

## Sanity check before declaring done

After Task 10:

- [ ] No `window.etherpadDesktop` reads inside `packages/shell/src/` (grep)
- [ ] No `import.*electron` inside `packages/shell/src/`
- [ ] No `@capacitor/*` imports anywhere (shouldn't exist yet)
- [ ] `packages/desktop/src/renderer/` contains only: `index.html`, `index.tsx`, `platform.electron.ts`, `global.d.ts`
- [ ] `packages/desktop/src/shared/` is gone
- [ ] `pnpm dev` works end-to-end
- [ ] Memory file updated
