# Claude Code instructions

**The canonical AI guide for this repo is `packages/desktop/AGENTS.md`** — read it first. This file
adds Claude-specific notes and project gotchas that other agents share too.

## Monorepo layout (read this first)

This repo is a pnpm workspace. Source lives under `packages/`:

- `packages/shell` (`@etherpad/shell`) — React renderer shell, Zustand state, i18n, types, validation, IPC channel names, the `Platform` injection seam (`setPlatform()` / `getPlatform()`). Consumed as source by `packages/desktop` and (soon) `packages/mobile`.
- `packages/desktop` (`@etherpad/desktop`) — Electron main + preload + the renderer entry that injects `createElectronPlatform()` and mounts the shell.

Run every `pnpm` command from the repo root. `pnpm test`, `pnpm typecheck`, and `pnpm lint` recurse across both packages via `pnpm -r`. Don't `cd` into a package directory for normal dev — it works but breaks IDE assumptions about where the workspace is.

Mobile (`packages/mobile`) lands in a later phase.

## Read first

- `packages/desktop/AGENTS.md` — full project overview: stack, dev loop, IPC patterns, how
  WebContentsViews are positioned, how tests are structured, and the
  house rules. Everything below assumes you've read it.
- `docs/superpowers/specs/2026-05-03-etherpad-desktop-linux-mvp-design.md`
  — the v1 design doc. v1 goals are met; v2/Spec 5+ items are listed
  there.
- `docs/superpowers/plans/2026-05-03-etherpad-desktop-linux-mvp.md`
  — milestone-shaped implementation plan that produced the current code.

## Project gotchas

These bite people who don't know them. Don't relearn the hard way.

- **There is no `etherpad-lite` npm package.** Etherpad core was renamed
  to `etherpad` and is distributed via GitHub Releases only — not npm.
  Earlier code (and the v1 spec) assumed `npx etherpad-lite@latest`
  works; it 404s. The embedded-server flow is currently disabled in the
  UI for this reason. The E2E fixture is now an in-process mock
  (`packages/desktop/tests/e2e/fixtures/etherpad.ts`) that returns the JSON shape the
  shell probes for.
- **Never use the name "etherpad-lite" in new packaging, docs, or
  configs.** Legacy paths in code (`ep_etherpad-lite/...`) can stay
  where they are, but new artefacts say "etherpad". The package name on
  npm `ep_etherpad-lite` is the upstream's choice and isn't ours.
- **Port 9003 for tests/snap, port 9001 for ad-hoc.** The user reserves
  9001 for manual local Etherpad spins; any test that binds an
  Etherpad-shaped service must use 9003. Defaults in spec configs stay
  9001.
- **Don't `rm dirty.db` or `rusty.db`.** Those *are* the pad store, not
  lock files. Deleting them wipes every pad. To clear lock files, kill
  the holding process; only `*.lock` files are safe to remove.
- **WebContentsViews are painted above the renderer.** When the rail
  collapses we leave a gutter on the left (`COLLAPSED_LEFT_GUTTER` in
  `packages/desktop/src/main/windows/app-window.ts`) so the DOM-rendered expand handle
  isn't covered by the native pad view. The CSS handle position and
  the gutter constant must agree — there's a regression test pinning
  this in `packages/desktop/tests/main/windows/app-window-layout.spec.ts`.
- **All user-facing strings go through i18n.** `t.<section>.<key>` from
  `packages/shell/src/i18n/`. No hardcoded English in JSX, aria-labels, or
  titles — use `fmt()` for placeholder substitution. The shape contract
  is pinned in `packages/shell/tests/i18n/i18n.spec.ts`.

## Working style for this repo

- **Inline execution.** When given a plan or spec the user expects work
  to land directly — don't pause for review of committed plan files.
- **Push on every fix.** This repo has a tracking remote on
  `feat/linux-mvp`; push to origin after each commit, not in batches.
- **Always run backend tests.** `pnpm test` recurses across `@etherpad/shell`
  and `@etherpad/desktop` (which itself runs the main vitest project).
  Running only the renderer half can miss real regressions. Backend tests
  caught dependency issues we didn't notice locally.
- **Wait ~20s and check CI after every push.** Fix CI failures
  immediately before moving on. `gh run list --branch feat/linux-mvp
  --limit 3` is the quick check.
- **Never push directly to `develop` or `main`.** Always use feature
  branches and PRs.
- **Skip `ep_kaput` in any sweeps, audits, or PRs.** The user manages it
  separately.

## Test conventions

- Tests assert behaviour through user-visible outcomes (rendered text,
  IPC calls, fired events) — not implementation details.
- For i18n/UI fixes, assert the *localized rendered string* and open the
  feature in a browser before declaring done — don't stop at "the
  element is present."
- E2E tests don't need a real Etherpad. The mock fixture is sufficient
  for shell behaviour; the editor itself is upstream's responsibility.
