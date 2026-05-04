# Etherpad Desktop

Native desktop client for [Etherpad](https://etherpad.org/). Multi-workspace
thin client with native chrome and per-workspace session isolation. Linux is
the launch platform; Windows and macOS land in subsequent releases.

## Status

Pre-release. See `docs/superpowers/specs/` for the design spec and
`docs/superpowers/plans/` for the implementation plan.

## Development

Requires Node 20+ and `pnpm`.

```bash
pnpm install
pnpm dev          # runs the app in dev mode
pnpm test         # unit + component tests
pnpm test:e2e     # Playwright E2E (requires Etherpad on :9003 — see fixtures)
pnpm typecheck
pnpm lint
pnpm package      # produces .AppImage and .deb under release/
```

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
