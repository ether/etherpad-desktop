# Etherpad Apps — Phase 1: Monorepo Workspace Conversion (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the existing single-package `etherpad-desktop` repo into a pnpm workspace with all current source under `packages/desktop/`, and a thin root `package.json` that proxies every existing script via `pnpm --filter @etherpad/desktop`. Zero behavioural change to the desktop app. CI green, all existing tests pass, `pnpm dev` / `pnpm test` / `pnpm test:e2e` / `pnpm build` / `pnpm package` all continue to work from the repo root.

**Architecture:** A pnpm workspace at the repo root with one package (`packages/desktop`) in v1 of this phase, designed to accept `packages/shell` and `packages/mobile` in subsequent phases without further structural change. Configs (`tsconfig*`, `electron.vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.js`) move to `packages/desktop/` and continue to resolve paths relative to *that* directory. The pnpm lockfile stays at the workspace root (one lockfile per workspace is the canonical pnpm pattern).

**Tech stack:** pnpm 10, Node 22, existing dev stack (Electron 41, React 19, TypeScript strict, Vitest, Playwright). No new runtime deps.

**Spec:** `docs/superpowers/specs/2026-05-11-etherpad-mobile-android-design.md` § 3 (Monorepo layout) and § 11 phase 1.

---

## Standard commands

All commands run from the repo root (`/home/jose/etherpad/etherpad-desktop/`) unless noted.

| Command | Purpose |
|---|---|
| `pnpm install` | Install workspace dependencies. |
| `pnpm dev` | Run desktop in dev mode (proxies to `pnpm --filter @etherpad/desktop dev`). |
| `pnpm build` | Production build (proxies). |
| `pnpm typecheck` | Run `tsc -b` across desktop's tsconfig graph. |
| `pnpm lint` | ESLint over `packages/desktop/src/` + `packages/desktop/tests/`. |
| `pnpm test` | Vitest single run. |
| `pnpm test:e2e` | Playwright E2E. |
| `pnpm package` | electron-builder Linux package (AppImage + deb). |

When a task says **"Verify acceptance"** it means: every command in the table above exits 0. CI is the canonical check; local runs of `pnpm lint && pnpm typecheck && pnpm test` are the fastest pre-push smoke.

---

## File structure

### Before (current state, repo root)

```
etherpad-desktop/
├── .github/workflows/{ci,release,release-please,snap-publish,dependabot-auto-merge}.yml
├── build/{electron-builder.yml, icons/}
├── docs/superpowers/{specs,plans}/
├── scripts/run-e2e.mjs
├── src/{main,preload,renderer,shared}/
├── tests/{e2e,main,renderer}/
├── electron.vite.config.ts
├── eslint.config.js
├── playwright.config.ts
├── vitest.config.ts
├── tsconfig.{base,main,preload,renderer,shared,tests}.json
├── tsconfig.json
├── package.json                 # "name": "etherpad-desktop"
├── pnpm-lock.yaml
├── AGENTS.md, CLAUDE.md, README.md, LICENSE, NOTICE, CHANGELOG.md, .gitignore
└── (build artefacts: node_modules, out, release, test-results — gitignored)
```

### After (target)

```
etherpad-desktop/                # repo dir; rename to "etherpad-apps" is a SEPARATE
                                 # task done via `gh repo rename` AFTER this PR
                                 # merges. The directory rename on disk is also out
                                 # of scope here — leave the local clone as-is.
├── .github/workflows/{ci,release,release-please,snap-publish,dependabot-auto-merge}.yml
│                                # paths inside workflows are UPDATED to reach into
│                                # packages/desktop/ artefacts
├── docs/superpowers/{specs,plans}/    # untouched
├── packages/
│   └── desktop/                 # @etherpad/desktop
│       ├── build/{electron-builder.yml, icons/}
│       ├── scripts/run-e2e.mjs
│       ├── src/{main,preload,renderer,shared}/
│       ├── tests/{e2e,main,renderer}/
│       ├── electron.vite.config.ts
│       ├── eslint.config.js
│       ├── playwright.config.ts
│       ├── vitest.config.ts
│       ├── tsconfig.{base,main,preload,renderer,shared,tests}.json
│       ├── tsconfig.json
│       ├── package.json         # "name": "@etherpad/desktop"
│       ├── AGENTS.md            # MOVED (was at repo root)
│       ├── CHANGELOG.md         # MOVED — release-please writes here now
│       └── README.md            # MOVED — desktop-specific notes
├── package.json                 # NEW — workspace root, "private": true, proxy scripts
├── pnpm-workspace.yaml          # NEW
├── pnpm-lock.yaml               # MOVED stays at repo root (canonical pnpm location)
├── release-please-config.json   # NEW — manifest mode for monorepo
├── .release-please-manifest.json # NEW — tracks per-package versions
├── CLAUDE.md                    # KEPT at root — points readers at packages/desktop
├── LICENSE, NOTICE              # KEPT at root — apply to whole repo
├── README.md                    # NEW root README — links to packages/desktop/README.md
└── .gitignore                   # UPDATED — packages/desktop/out, release, etc.
```

### Key invariants

- **Lockfile at root.** Never `pnpm-lock.yaml` inside `packages/desktop/`. pnpm errors with "found a different lockfile" if you do.
- **Config files move with code.** `electron.vite.config.ts` references `src/main/index.ts` — that path is relative to the config file, which is now in `packages/desktop/`, so `src/main/index.ts` resolves to `packages/desktop/src/main/index.ts`. No path edits needed *inside* configs.
- **Workflow paths CHANGE.** Workflows run from the repo root checkout. References to `release/*.AppImage`, `build/electron-builder.yml`, etc., need to become `packages/desktop/release/*.AppImage`, `packages/desktop/build/electron-builder.yml`.

---

## Milestone overview

Phase 1 is a single milestone executed across these tasks. Each task is **one commit** unless noted; intermediate broken states are not committed.

| # | Task | Files | Verify |
|---|---|---|---|
| 1 | Branch + safety: confirm clean main, create `feat/monorepo-phase1` | — | `git status -s` empty after checkout |
| 2 | Bootstrap workspace skeleton | `pnpm-workspace.yaml`, `packages/desktop/.gitkeep` | `pnpm install` exit 0 |
| 3 | Move source + tests + scripts + build dir | `packages/desktop/{src,tests,scripts,build}` | `git status` shows clean moves |
| 4 | Move config files | `packages/desktop/{electron.vite.config.ts,vitest.config.ts,playwright.config.ts,eslint.config.js,tsconfig*.json}` | `git status` |
| 5 | Move + rename `package.json`, keep lockfile at root | `packages/desktop/package.json`, root `pnpm-lock.yaml` | `pnpm install --frozen-lockfile` |
| 6 | Move repo-internal docs into packages/desktop | `packages/desktop/{AGENTS.md,CHANGELOG.md,README.md}` | files exist |
| 7 | Create root `package.json` with proxy scripts | `package.json` (new at root) | `pnpm install` |
| 8 | Update `.gitignore` for new paths | `.gitignore` | nothing | 
| 9 | Add root README pointing at packages | `README.md` (new at root) | manual read |
| 10 | Update `CLAUDE.md` pointers | `CLAUDE.md` | manual read |
| 11 | Verify full local pipeline | — | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` |
| 12 | Verify E2E from root | — | `pnpm test:e2e` |
| 13 | Verify packaging from root | — | `pnpm package` builds an AppImage |
| 14 | Update CI workflow paths | `.github/workflows/ci.yml` | `pnpm lint` etc. unchanged commands, but artefact paths change |
| 15 | Update release workflow paths | `.github/workflows/release.yml` | inspect diff |
| 16 | Update snap-publish workflow paths | `.github/workflows/snap-publish.yml` | inspect diff |
| 17 | Convert release-please to monorepo manifest mode | `release-please-config.json`, `.release-please-manifest.json`, `.github/workflows/release-please.yml` | dry-run |
| 18 | Open PR + verify CI green + merge gate | — | `gh pr create`, wait ~20s, `gh run list` |

---

## Task 1: Branch and safety check

**Files:** none (git state only)

- [ ] **Step 1: Confirm clean working tree on `main`**

Run:
```bash
cd /home/jose/etherpad/etherpad-desktop
git fetch origin
git checkout main
git pull --ff-only origin main
git status -s
```

Expected: empty output (no uncommitted changes). If output is non-empty, stop and surface the dirty state to the user before continuing — DO NOT discard their work.

- [ ] **Step 2: Confirm the spec doc is on main**

Run:
```bash
ls docs/superpowers/specs/2026-05-11-etherpad-mobile-android-design.md
```

Expected: file exists. If it doesn't, the spec PR (`feat/mobile-android-spec`) hasn't merged yet — pause and tell the user.

- [ ] **Step 3: Create the working branch**

Run:
```bash
git checkout -b feat/monorepo-phase1
```

Expected: `Switched to a new branch 'feat/monorepo-phase1'`.

No commit yet.

---

## Task 2: Bootstrap workspace skeleton

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `packages/desktop/.gitkeep`

- [ ] **Step 1: Write `pnpm-workspace.yaml`**

Create `pnpm-workspace.yaml` at the repo root:

```yaml
packages:
  - packages/*
```

- [ ] **Step 2: Create the empty packages directory**

Run:
```bash
mkdir -p packages/desktop
touch packages/desktop/.gitkeep
```

- [ ] **Step 3: Verify pnpm still installs**

Run:
```bash
pnpm install
```

Expected: exits 0. pnpm now reports the workspace exists but treats the root `package.json` as the only package (because `packages/desktop` has no `package.json` yet).

- [ ] **Step 4: Commit**

```bash
git add pnpm-workspace.yaml packages/desktop/.gitkeep
git commit -m "$(cat <<'EOF'
chore(monorepo): bootstrap pnpm workspace skeleton

First step of monorepo conversion (spec §3 phase 1). Adds the empty
packages/ directory and pnpm-workspace.yaml. No file moves yet — the
existing single-package layout still works.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Move source, tests, scripts, build directory

**Files:**
- Move: `src/` → `packages/desktop/src/`
- Move: `tests/` → `packages/desktop/tests/`
- Move: `scripts/` → `packages/desktop/scripts/`
- Move: `build/` → `packages/desktop/build/`

- [ ] **Step 1: Move with `git mv` so history is preserved**

Run from repo root:
```bash
git mv src packages/desktop/src
git mv tests packages/desktop/tests
git mv scripts packages/desktop/scripts
git mv build packages/desktop/build
```

- [ ] **Step 2: Sanity check the moves**

Run:
```bash
ls packages/desktop/
git status -s | head
```

Expected: `build/  scripts/  src/  tests/  .gitkeep` listed under `packages/desktop/`. `git status` shows `R  src -> packages/desktop/src` etc.

- [ ] **Step 3: Remove the placeholder**

```bash
git rm packages/desktop/.gitkeep
```

(The directory is no longer empty so the placeholder is dead weight.)

**DO NOT COMMIT YET.** Configs and `package.json` still reference the old paths from this position; the next tasks fix that. We commit Tasks 3–7 together as one structural commit.

---

## Task 4: Move config files into packages/desktop

**Files:**
- Move: `electron.vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.js`
- Move: `tsconfig.json`, `tsconfig.base.json`, `tsconfig.main.json`, `tsconfig.preload.json`, `tsconfig.renderer.json`, `tsconfig.shared.json`, `tsconfig.tests.json`

- [ ] **Step 1: Move every config file with `git mv`**

```bash
git mv electron.vite.config.ts   packages/desktop/electron.vite.config.ts
git mv vitest.config.ts          packages/desktop/vitest.config.ts
git mv playwright.config.ts      packages/desktop/playwright.config.ts
git mv eslint.config.js          packages/desktop/eslint.config.js
git mv tsconfig.json             packages/desktop/tsconfig.json
git mv tsconfig.base.json        packages/desktop/tsconfig.base.json
git mv tsconfig.main.json        packages/desktop/tsconfig.main.json
git mv tsconfig.preload.json     packages/desktop/tsconfig.preload.json
git mv tsconfig.renderer.json    packages/desktop/tsconfig.renderer.json
git mv tsconfig.shared.json      packages/desktop/tsconfig.shared.json
git mv tsconfig.tests.json       packages/desktop/tsconfig.tests.json
```

- [ ] **Step 2: Confirm no edits are needed inside the configs**

Configs use paths relative to the file's own directory (e.g., `resolve('src/main/index.ts')` resolves against `process.cwd()`, which will be `packages/desktop/` when pnpm runs scripts via `--filter`). Run a quick visual check:

```bash
grep -n "resolve\|root\|testDir\|include" packages/desktop/electron.vite.config.ts \
  packages/desktop/vitest.config.ts \
  packages/desktop/playwright.config.ts
```

Expected: all paths look like `src/...`, `tests/...`, `tests/e2e`, `src/shared` — those resolve correctly relative to `packages/desktop/`. No edits required.

If you spot any absolute path or any `../` reference, STOP and verify it still makes sense from the new location before continuing.

**DO NOT COMMIT YET.**

---

## Task 5: Move + rename package.json, keep lockfile at root

**Files:**
- Move + edit: `package.json` → `packages/desktop/package.json`
- Keep at root: `pnpm-lock.yaml` (no move)

- [ ] **Step 1: Move package.json**

```bash
git mv package.json packages/desktop/package.json
```

- [ ] **Step 2: Edit `packages/desktop/package.json` — rename and make private**

Open `packages/desktop/package.json` and change the `"name"` field:

```diff
- "name": "etherpad-desktop",
+ "name": "@etherpad/desktop",
```

Add `"private": true` immediately after (if not already present — check first; the existing file has it):

```json
{
  "name": "@etherpad/desktop",
  "private": true,
  "version": "0.3.2",
  ...
}
```

Leave the rest of the file (scripts, dependencies, packageManager, pnpm config) **unchanged**. Those will still work because `pnpm --filter @etherpad/desktop <script>` runs the script in `packages/desktop/`.

- [ ] **Step 3: Verify lockfile is still at repo root**

Run from repo root:
```bash
ls pnpm-lock.yaml && [ ! -f packages/desktop/pnpm-lock.yaml ] && echo OK
```

Expected: `pnpm-lock.yaml` and `OK`. If a lockfile appears inside `packages/desktop/`, delete it — there must be exactly one at the workspace root.

**DO NOT COMMIT YET.**

---

## Task 6: Move repo-internal docs into packages/desktop

**Files:**
- Move: `AGENTS.md` → `packages/desktop/AGENTS.md`
- Move: `CHANGELOG.md` → `packages/desktop/CHANGELOG.md`
- Move: `README.md` → `packages/desktop/README.md`

Rationale: `AGENTS.md` describes the desktop app specifically. The existing `CHANGELOG.md` is the desktop's release-please-managed changelog and must live next to the package.json release-please tracks. The old root `README.md` is desktop-focused; a new generic root README is added in Task 9.

- [ ] **Step 1: Move the three docs**

```bash
git mv AGENTS.md      packages/desktop/AGENTS.md
git mv CHANGELOG.md   packages/desktop/CHANGELOG.md
git mv README.md      packages/desktop/README.md
```

`LICENSE`, `NOTICE`, and `CLAUDE.md` remain at the repo root (LICENSE/NOTICE apply to the whole repo; CLAUDE.md will be edited in Task 10 to reflect the new layout).

**DO NOT COMMIT YET.**

---

## Task 7: Create root `package.json` with proxy scripts

**Files:**
- Create: `package.json` (new file at repo root)

- [ ] **Step 1: Write the root package.json**

Create `/home/jose/etherpad/etherpad-desktop/package.json`:

```json
{
  "name": "etherpad-apps",
  "private": true,
  "version": "0.0.0",
  "description": "Etherpad apps (desktop, mobile) — monorepo root.",
  "license": "Apache-2.0",
  "author": "Etherpad Foundation",
  "homepage": "https://etherpad.org/",
  "repository": "github:ether/etherpad-desktop",
  "packageManager": "pnpm@10.33.0",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "dev": "pnpm --filter @etherpad/desktop dev",
    "build": "pnpm --filter @etherpad/desktop build",
    "typecheck": "pnpm --filter @etherpad/desktop typecheck",
    "lint": "pnpm --filter @etherpad/desktop lint",
    "format": "pnpm --filter @etherpad/desktop format",
    "test": "pnpm --filter @etherpad/desktop test",
    "test:watch": "pnpm --filter @etherpad/desktop test:watch",
    "test:e2e": "pnpm --filter @etherpad/desktop test:e2e",
    "package": "pnpm --filter @etherpad/desktop package",
    "package:win": "pnpm --filter @etherpad/desktop package:win",
    "package:linux": "pnpm --filter @etherpad/desktop package:linux",
    "package:mac": "pnpm --filter @etherpad/desktop package:mac",
    "start": "pnpm --filter @etherpad/desktop start"
  }
}
```

Notes:
- Root has **no dependencies** — every dep lives in its package's `package.json`. pnpm hoists into a shared `node_modules/.pnpm` store.
- `version: "0.0.0"` for the root because the root itself never ships; per-package versions are tracked by `.release-please-manifest.json` (added in Task 17).
- `packageManager` is the canonical pinned pnpm version — must match `packages/desktop/package.json`'s entry to avoid pnpm-action-setup conflicts.

- [ ] **Step 2: Reinstall to validate the workspace links up**

Run from repo root:
```bash
rm -rf node_modules packages/desktop/node_modules
pnpm install
```

Expected: pnpm reports installing for two projects (`etherpad-apps` root and `@etherpad/desktop`). No errors. `packages/desktop/node_modules` and root `node_modules` both populated; the `.pnpm` store is at root.

- [ ] **Step 3: Now commit the big structural move (Tasks 3–7)**

```bash
git add -A
git status -s
```

Expected: a long list of renames (`R src/... -> packages/desktop/src/...`) plus the new root `package.json` and the deleted `packages/desktop/.gitkeep`.

```bash
git commit -m "$(cat <<'EOF'
refactor(monorepo): move desktop into packages/desktop

Moves all source, tests, scripts, build dir, config files, and the
desktop-specific docs (AGENTS.md, CHANGELOG.md, README.md) into
packages/desktop/. Renames the package to @etherpad/desktop and adds a
thin root package.json that proxies every script via
`pnpm --filter @etherpad/desktop`.

The pnpm lockfile stays at the workspace root (canonical pnpm layout).
LICENSE, NOTICE, and CLAUDE.md remain at the repo root because they
apply to the whole repo.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Update `.gitignore` for new paths

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Inspect current ignore patterns**

Run:
```bash
cat .gitignore
```

- [ ] **Step 2: Update root `.gitignore` so it covers nested paths**

The existing patterns (e.g. `node_modules`, `out`, `release`, `test-results`, `playwright-report`) were written assuming they sit at repo root. They already match nested paths because they're not anchored with `/`. **But** if any pattern starts with `/` (e.g. `/out`), it only matches at root and needs to be expanded.

Run:
```bash
grep -n "^/" .gitignore || echo "no anchored patterns"
```

If any anchored patterns exist, either:
- Remove the leading `/` so the pattern matches everywhere (preferred), OR
- Add a second line for `/packages/desktop/<pattern>`.

For the existing repo state (verified in the desktop CLAUDE.md), the typical gitignore has unanchored `node_modules`, `out`, `release`, `dist`, `coverage`, `test-results`, `playwright-report`, `.cache`. These all already match `packages/desktop/<thing>` — no edit needed.

- [ ] **Step 3: Verify**

```bash
git status --ignored | grep -E "packages/desktop/(node_modules|out|release)" || true
git check-ignore -v packages/desktop/node_modules packages/desktop/out packages/desktop/release 2>&1
```

Expected: each path is reported as ignored (matched by the appropriate `.gitignore` rule).

- [ ] **Step 4: Commit (only if you actually changed `.gitignore`)**

```bash
git add .gitignore
git diff --cached --stat
git commit -m "$(cat <<'EOF'
chore(gitignore): cover packages/desktop nested build artefacts

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If no edit was needed, skip this commit.

---

## Task 9: Add root README pointing at packages

**Files:**
- Create: `README.md` (new at repo root)

- [ ] **Step 1: Write the root README**

Create `/home/jose/etherpad/etherpad-desktop/README.md`:

```markdown
# Etherpad apps

Cross-platform clients for [Etherpad](https://etherpad.org/) — currently desktop, with mobile in development.

This is a pnpm monorepo.

| Package | Status | Source |
|---|---|---|
| `@etherpad/desktop` | Released | [`packages/desktop`](packages/desktop) |
| `@etherpad/mobile` | In development (Android first, iOS-ready) | `packages/mobile` (added in phase 3) |
| `@etherpad/shell` | Pending refactor (phase 2 of mobile rollout) | `packages/shell` |

## Quick start (desktop)

```bash
pnpm install
pnpm dev
```

See [`packages/desktop/README.md`](packages/desktop/README.md) for full developer documentation.

## Layout

- `packages/desktop/` — Electron app (Linux AppImage, deb, snap; macOS DMG; Windows NSIS).
- `docs/` — specs, plans, and shared internal docs.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs(root): add monorepo README pointing at packages/desktop

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Update root `CLAUDE.md` pointers

**Files:**
- Modify: `CLAUDE.md` (at repo root)

The current `CLAUDE.md` references paths like `src/renderer/i18n/` and `tests/main/windows/app-window-layout.spec.ts`. After the move, those paths are under `packages/desktop/`.

- [ ] **Step 1: Open and skim the current content**

Run:
```bash
wc -l CLAUDE.md
head -30 CLAUDE.md
```

- [ ] **Step 2: Rewrite the file**

The whole file's frame ("AGENTS.md is canonical, here are gotchas") still applies but should point readers at `packages/desktop/AGENTS.md` and use updated paths. Edit `CLAUDE.md` so:

1. The "Read first" pointers list `packages/desktop/AGENTS.md` (instead of `AGENTS.md`) and `docs/superpowers/specs/2026-05-11-etherpad-mobile-android-design.md` as the new active spec.
2. Every code path mentioned (e.g. `src/main/...`, `src/renderer/...`, `tests/...`) is prefixed `packages/desktop/`. This is a bulk find-and-replace task — run this sed to do the mechanical pass, then read the diff and adjust any false positives:

```bash
sed -i \
  -e 's|`src/|`packages/desktop/src/|g' \
  -e 's|`tests/|`packages/desktop/tests/|g' \
  -e 's|`AGENTS\.md`|`packages/desktop/AGENTS.md`|g' \
  CLAUDE.md
```

3. Add a NEW section near the top, before "Project gotchas":

```markdown
## Monorepo layout (read this first)

This repo is a pnpm workspace as of 2026-05. The desktop app lives in `packages/desktop`. Run every `pnpm` command from the repo root — the root `package.json` proxies every script via `pnpm --filter @etherpad/desktop`. Don't `cd` into `packages/desktop` for normal dev — it works but breaks IDE assumptions about where the workspace is.

Mobile (`packages/mobile`) and shell (`packages/shell`) are coming in subsequent phases; today there is only `packages/desktop`.
```

- [ ] **Step 3: Re-read the file end-to-end**

Open the file and read it through. Look for:
- Any remaining bare `src/` or `tests/` reference outside a code path (e.g. prose like "the renderer's `src/renderer/...`") that the sed missed.
- Any broken backtick quoting (sed can over-match).
- Spec pointer is updated to `2026-05-11-etherpad-mobile-android-design.md`.

Fix any issues found.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(claude): update CLAUDE.md paths for packages/desktop layout

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Verify full local pipeline (lint / typecheck / unit tests / build)

**Files:** none

This is the first real validation that the move didn't break anything.

- [ ] **Step 1: Lint**

Run from repo root:
```bash
pnpm lint
```

Expected: exit 0. Any errors here are ESLint config-resolution problems — `eslint.config.js` should be inside `packages/desktop/` and pnpm should run it with cwd = `packages/desktop/`. If lint fails with "no eslint config found" it means the move missed the eslint config or `package.json`'s `lint` script lost its cwd; check both.

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: exit 0. The tsconfig graph (`tsconfig.json` → references) is self-contained in `packages/desktop/`, so paths resolve relative to that.

- [ ] **Step 3: Run unit + component tests**

```bash
pnpm test
```

Expected: all suites (`main` node-env, `renderer` jsdom-env) pass. Same count as before the move. If a test fails with "cannot find module `@shared/...`" the vitest config's alias didn't move — check `packages/desktop/vitest.config.ts`.

- [ ] **Step 4: Build**

```bash
pnpm build
```

Expected: exit 0. `packages/desktop/out/{main,preload,renderer}` produced. The build artefact directory `out/` now lives inside `packages/desktop/`.

- [ ] **Step 5: If anything failed, STOP**

Do not paper over failures. Each failure surfaces a real path/config issue that must be fixed in the appropriate config file (then `git commit --amend` into Task 7's commit, or open a follow-up commit on this branch — your call, but the root cause must be fixed, not bypassed).

If everything passes, no commit here (this task is verification only).

---

## Task 12: Verify E2E from root

**Files:** none

- [ ] **Step 1: Install playwright browsers (one-time, idempotent)**

```bash
pnpm --filter @etherpad/desktop exec playwright install --with-deps chromium
```

The `--filter` is required: `playwright-core` is a workspace dep of `@etherpad/desktop`, not of the root, so bare `pnpm exec` from the repo root would fail to find it.

- [ ] **Step 2: Run the E2E suite**

```bash
pnpm test:e2e
```

Expected: all e2e tests pass. The xvfb auto-detect logic in `packages/desktop/scripts/run-e2e.mjs` works the same from this cwd because the script uses relative invocations (`pnpm exec playwright test`).

- [ ] **Step 3: If E2E fails, inspect playwright-report**

```bash
ls packages/desktop/playwright-report/ 2>/dev/null || ls playwright-report/ 2>/dev/null
```

(The report directory might land in either root or `packages/desktop/` depending on Playwright's cwd. Either is fine for this verification; we update workflow paths in Task 14 to handle whichever Playwright actually picks.)

Fix any real failures; do not commit until E2E is green.

---

## Task 13: Verify packaging from root

**Files:** none

- [ ] **Step 1: Build the Linux package**

```bash
pnpm package
```

Expected: electron-builder runs from `packages/desktop/` (because `pnpm --filter` sets cwd), reads `build/electron-builder.yml` (resolves relative to that cwd), and emits artefacts into `packages/desktop/release/`. Run completes with exit 0.

- [ ] **Step 2: Confirm artefacts land in the expected place**

```bash
ls packages/desktop/release/*.AppImage packages/desktop/release/*.deb
```

Expected: at least one AppImage + one deb. (Filenames include the version, e.g. `etherpad-desktop-0.3.2.AppImage`.)

- [ ] **Step 3: Smoke-launch the AppImage (optional but cheap)**

```bash
chmod +x packages/desktop/release/*.AppImage
ls packages/desktop/release/*.AppImage | head -1
# Do NOT auto-run from here — the desktop window will steal focus. Ask the
# user (or skip in headless CI). For a non-interactive smoke, just confirm
# the file is a valid AppImage:
file packages/desktop/release/*.AppImage
```

Expected: `... ELF 64-bit LSB executable, x86-64, ... (FUSE AppImage)` or similar.

No commit here.

---

## Task 14: Update CI workflow paths

**Files:**
- Modify: `.github/workflows/ci.yml`

The current `ci.yml` invokes `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm build` — all from repo root. With the proxy scripts in the new root `package.json`, those still work as-is.

The only path that changes is the upload-artifact step for `playwright-report/`: that now lives at `packages/desktop/playwright-report/`.

- [ ] **Step 1: Update the e2e upload-artifact path**

Open `.github/workflows/ci.yml`. Find the step:

```yaml
      - uses: actions/upload-artifact@v7
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

Change `path:` to:

```yaml
          path: packages/desktop/playwright-report/
```

- [ ] **Step 2: Update the playwright install step**

In the same workflow, find:

```yaml
      - run: pnpm exec playwright install --with-deps chromium
```

Change to:

```yaml
      - run: pnpm --filter @etherpad/desktop exec playwright install --with-deps chromium
```

`playwright-core` is a workspace dep of `@etherpad/desktop`; bare `pnpm exec` from the root won't resolve it.

- [ ] **Step 3: Confirm no other paths leak**

```bash
grep -n "src/\|tests/\|build/\|release/" .github/workflows/ci.yml || echo "clean"
```

Expected: `clean`. If anything matches, eyeball it and prefix with `packages/desktop/` where appropriate.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
ci(monorepo): point playwright + report paths at packages/desktop/

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Update release workflow paths

**Files:**
- Modify: `.github/workflows/release.yml`

Several paths in this workflow reach into the old `release/` directory and `build/electron-builder.yml`. All become `packages/desktop/...`.

- [ ] **Step 1: Edit the file with the following replacements**

Apply these specific changes (each is a single-line replacement):

| Line content (search) | Replace with |
|---|---|
| `pnpm exec electron-builder --linux AppImage deb --config build/electron-builder.yml --publish always` | `pnpm --filter @etherpad/desktop exec electron-builder --linux AppImage deb --config build/electron-builder.yml --publish always` |
| `release/*.AppImage` | `packages/desktop/release/*.AppImage` |
| `release/*.deb` | `packages/desktop/release/*.deb` |
| `release/latest-linux.yml` | `packages/desktop/release/latest-linux.yml` |
| `pnpm exec electron-builder --mac --config build/electron-builder.yml --publish always` | `pnpm --filter @etherpad/desktop exec electron-builder --mac --config build/electron-builder.yml --publish always` |
| `release/*.dmg` | `packages/desktop/release/*.dmg` |
| `release/*-mac.zip` | `packages/desktop/release/*-mac.zip` |
| `release/latest-mac.yml` | `packages/desktop/release/latest-mac.yml` |
| `pnpm exec electron-builder --win --config build/electron-builder.yml --publish always` | `pnpm --filter @etherpad/desktop exec electron-builder --win --config build/electron-builder.yml --publish always` |
| `release/*.exe` | `packages/desktop/release/*.exe` |
| `release/latest.yml` | `packages/desktop/release/latest.yml` |

Why `pnpm --filter @etherpad/desktop exec ...`: the electron-builder binary is a workspace dep of `@etherpad/desktop`, not of the root. Without the filter, `pnpm exec` from root won't find it.

The `pnpm build` step earlier in each job already works via the proxy script — no change there.

- [ ] **Step 2: Sanity grep**

```bash
grep -n "release/\|electron-builder.yml" .github/workflows/release.yml | head
```

Every match should now be `packages/desktop/release/...` or `packages/desktop/build/electron-builder.yml`. If any bare `release/` or `build/` remains, fix it.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "$(cat <<'EOF'
ci(release): prefix release artefact paths with packages/desktop/

electron-builder runs via `pnpm --filter @etherpad/desktop exec` so the
binary resolves against the desktop workspace; artefact paths reach
into packages/desktop/release/ for upload.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Update snap-publish workflow paths

**Files:**
- Modify: `.github/workflows/snap-publish.yml`

Mirrors Task 15's changes for the snap target.

- [ ] **Step 1: Apply replacements**

| Line content (search) | Replace with |
|---|---|
| `pnpm exec electron-builder --linux snap --config build/electron-builder.yml --publish never` | `pnpm --filter @etherpad/desktop exec electron-builder --linux snap --config build/electron-builder.yml --publish never` |
| `file=$(ls release/*.snap | head -n1)` | `file=$(ls packages/desktop/release/*.snap | head -n1)` |
| `path: release/*.snap` | `path: packages/desktop/release/*.snap` |

The `find . -name '*.snap'` fallback the script considered, if any, is also fine — but the explicit `packages/desktop/release/*.snap` is clearer.

- [ ] **Step 2: Sanity grep**

```bash
grep -n "release/\|electron-builder.yml" .github/workflows/snap-publish.yml
```

All matches must be prefixed `packages/desktop/`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/snap-publish.yml
git commit -m "$(cat <<'EOF'
ci(snap): prefix snap artefact paths with packages/desktop/

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Convert release-please to monorepo manifest mode

**Files:**
- Create: `release-please-config.json`
- Create: `.release-please-manifest.json`
- Modify: `.github/workflows/release-please.yml`

`release-please-action` in default `release-type: node` mode expects `./package.json` to be the released package. After the move, the root's `package.json` is a workspace marker, not a releasable package — release-please would version-bump the wrong file and write `CHANGELOG.md` to the wrong place. Switching to manifest mode tells it explicitly which package(s) to release.

We keep the existing tag format `v<version>` for Phase 1 so the existing `release.yml` (`tags: ['v*']`) and `snap-publish.yml` (`v[0-9]+.[0-9]+.[0-9]+`) triggers fire on the same tag shape. The shell+mobile packages will get their own components and tag prefixes later.

- [ ] **Step 1: Create `release-please-config.json`**

```json
{
  "packages": {
    "packages/desktop": {
      "release-type": "node",
      "package-name": "@etherpad/desktop",
      "changelog-path": "CHANGELOG.md",
      "include-component-in-tag": false,
      "include-v-in-tag": true
    }
  },
  "separate-pull-requests": false,
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json"
}
```

Key flags:
- `include-component-in-tag: false` → tag is `v0.3.3`, not `@etherpad/desktop-v0.3.3`. Preserves existing release.yml trigger pattern.
- `include-v-in-tag: true` → tag prefix `v` (matches existing `v*` trigger).
- `changelog-path: CHANGELOG.md` → relative to `packages/desktop/`, so written to `packages/desktop/CHANGELOG.md`.

- [ ] **Step 2: Create `.release-please-manifest.json`**

This file records the current version of each managed package. Find the current desktop version:

```bash
grep '"version"' packages/desktop/package.json
```

Expected: `"version": "0.3.2"` (or whatever the latest tagged release is).

Create `.release-please-manifest.json` with that version:

```json
{
  "packages/desktop": "0.3.2"
}
```

Use the actual version from the grep above — DO NOT hardcode `0.3.2` if the grep shows something different.

- [ ] **Step 3: Update `.github/workflows/release-please.yml`**

Edit the file:

```diff
       - uses: googleapis/release-please-action@v5
         with:
-          # `node` mode keeps package.json's version field as the source
-          # of truth and writes a top-level CHANGELOG.md.
-          release-type: node
+          # Manifest mode for the monorepo. Configuration lives in
+          # release-please-config.json; current versions in
+          # .release-please-manifest.json. The desktop package is the
+          # only released package today; mobile/shell will be added
+          # as separate components in later phases.
+          config-file: release-please-config.json
+          manifest-file: .release-please-manifest.json
           token: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 4: Dry-run sanity check (optional)**

Run from repo root:
```bash
ls release-please-config.json .release-please-manifest.json packages/desktop/CHANGELOG.md
```

Expected: all three exist. We can't actually dry-run release-please locally without push access, but the file structure being right is the main thing.

- [ ] **Step 5: Commit**

```bash
git add release-please-config.json .release-please-manifest.json .github/workflows/release-please.yml
git commit -m "$(cat <<'EOF'
ci(release-please): switch to monorepo manifest mode

Desktop is now the only managed package; manifest mode lets us add
mobile/shell later as additional components without further migration.
Tag format unchanged (v<version>) so release.yml and snap-publish.yml
triggers fire on the same shape.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: Open PR, verify CI, merge gate

**Files:** none (git/GitHub state only)

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/monorepo-phase1
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --base main --title "refactor: convert repo to pnpm monorepo (packages/desktop)" --body "$(cat <<'EOF'
## Summary

- Convert single-package repo to a pnpm workspace with all current source under `packages/desktop/`.
- Add a thin root `package.json` that proxies every script via `pnpm --filter @etherpad/desktop`.
- Move `AGENTS.md`, `CHANGELOG.md`, `README.md` to `packages/desktop/`; add a new generic root README.
- Update CI / release / snap-publish workflow paths and switch release-please to monorepo manifest mode.

Zero behavioural change to the desktop app. This is phase 1 of the
mobile rollout (see `docs/superpowers/specs/2026-05-11-etherpad-mobile-android-design.md`
§3 and §11).

## Test plan

- [ ] CI `lint-typecheck-test` job green
- [ ] CI `e2e` job green
- [ ] `pnpm package` builds an AppImage + deb locally
- [ ] release-please opens (or updates) the next-version PR after merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait ~20s and check CI status**

```bash
sleep 20
gh pr checks --watch
```

Expected: both `lint-typecheck-test` and `e2e` pass.

- [ ] **Step 4: Fix anything that broke**

Common failure modes and their fixes:
- `lint failed: no config found` → `eslint.config.js` wasn't moved (Task 4 missed) or root `lint` script doesn't filter to desktop. Check both.
- `test failed: cannot find module @shared/...` → `vitest.config.ts` alias didn't move with the file, or the move corrupted it. Inspect `packages/desktop/vitest.config.ts`.
- `e2e failed: cannot find electron binary` → `pnpm install` didn't run with the right cwd in CI. Confirm `pnpm install --frozen-lockfile` runs at workspace root.
- `e2e upload-artifact: no files found` → playwright-report path in `ci.yml` wasn't updated (Task 14).
- release.yml fails on tag → some path replacement missed in Task 15. Check the failed log.

For each failure: fix the root cause in a new commit on this branch, push, re-watch CI.

- [ ] **Step 5: Merge once green**

```bash
gh pr merge --auto --squash --delete-branch
```

Auto-merge will fire once required checks pass.

- [ ] **Step 6: Pull main locally**

```bash
git checkout main
git pull --ff-only origin main
```

- [ ] **Step 7: Sanity smoke after merge**

```bash
pnpm install
pnpm test
```

Expected: clean install, all tests pass on `main`.

---

## Acceptance criteria for Phase 1

This phase is **done** when:

1. `main` has `packages/desktop/` containing all desktop source and the desktop's `package.json` named `@etherpad/desktop`.
2. Repo root has `pnpm-workspace.yaml`, a new generic `package.json` with proxy scripts, `pnpm-lock.yaml`, `README.md`, `CLAUDE.md`, `LICENSE`, `NOTICE`, `release-please-config.json`, `.release-please-manifest.json`.
3. `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm test:e2e`, `pnpm package`, `pnpm lint`, `pnpm typecheck` all exit 0 from the repo root.
4. CI `lint-typecheck-test` and `e2e` jobs green on `main`.
5. A pushed semver tag (whether by release-please or manual) successfully triggers `release.yml` and `snap-publish.yml` and produces artefacts at `packages/desktop/release/*.{AppImage,deb,snap}`.

Item 5 is verified post-merge on the next real release. If you want to verify it on this branch *before* merge, push a no-op tag like `v0.3.2-test` to a fork and watch the workflows there — but that's optional.

---

## Out of scope for this phase (handled in later phases)

- Extracting `@etherpad/shell` from `packages/desktop/src/{renderer,shared}` (phase 2).
- Adding `@etherpad/mobile` Capacitor scaffold (phase 3).
- Renaming the repo on GitHub from `etherpad-desktop` to `etherpad-apps` (defer — the directory name and remote URL can stay until mobile work begins, to avoid breaking external links).
- Adding mobile-specific CI workflow (`mobile-release.yml`, phase 8).
- Updating `dependabot.yml` ecosystems for the monorepo (revisit once `packages/mobile/` exists and adds Gradle/Cocoapods deps).

---

## If a step fails

If you hit a failure on any task:
1. Read the failure message carefully — the most common issues are documented under Task 18 step 4.
2. Fix the underlying config (don't bypass with `--no-verify` or by skipping tests).
3. If a step's commit was already made and the fix belongs in the same commit, use `git commit --amend` (this branch has not been merged yet so amending is safe).
4. If multiple commits need to be threaded together, leave them as separate fix-up commits — release-please's squash on merge will collapse them.
5. Surface the root cause to the user if it's something the plan didn't anticipate, rather than papering over it.
