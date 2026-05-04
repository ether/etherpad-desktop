# AGENTS.md

Guidance for AI agents working in this repo.

## Dev loop

- Install: `pnpm install`
- Run: `pnpm dev`
- Test: `pnpm test` (unit) and `pnpm test:e2e` (E2E — needs Etherpad on :9003)
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Format: `pnpm format`
- Package: `pnpm package`

## Conventions

- TypeScript strict; no JS in the source tree.
- All persistent state goes through main-process stores. Renderer never touches disk.
- IPC payloads are Zod-validated in main; channels are defined in `src/shared/ipc/channels.ts`.
- Each `WebContentsView` is created via `pad-view-factory.ts` — that is the seam for future offline + embedded-server work.
- E2E tests use port `9003` for Etherpad, never `9001`.

## House rules

- Match the spec at `docs/superpowers/specs/2026-05-03-etherpad-desktop-linux-mvp-design.md`.
- Never log pad content or pad names. Workspace IDs (UUIDs) are fine.
- Never use the name "etherpad-lite" in new code, packaging, or docs — the project is "etherpad".
