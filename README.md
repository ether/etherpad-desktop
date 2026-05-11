# Etherpad apps

Cross-platform clients for [Etherpad](https://etherpad.org/) — currently desktop, with mobile in development.

This is a pnpm monorepo.

| Package | Status | Source |
|---|---|---|
| `@etherpad/desktop` | Released | [`packages/desktop`](packages/desktop) |
| `@etherpad/shell` | Source-consumed workspace dep | [`packages/shell`](packages/shell) |
| `@etherpad/mobile` | In development (Android first, iOS-ready) | `packages/mobile` (added in phase 3) |

## Quick start (desktop)

```bash
pnpm install
pnpm dev
```

See [`packages/desktop/README.md`](packages/desktop/README.md) for full developer documentation.

## Layout

- `packages/desktop/` — Electron app (Linux AppImage, deb, snap; macOS DMG; Windows NSIS).
- `packages/shell/` — React renderer shell shared between desktop and (soon) mobile. Owns dialogs, state, i18n, and the `Platform` injection seam.
- `docs/` — specs, plans, and shared internal docs.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
