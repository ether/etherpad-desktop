# Etherpad apps

Cross-platform clients for [Etherpad](https://etherpad.org/) — currently desktop, with mobile in development.

This is a pnpm monorepo.

| Package | Status | Source |
|---|---|---|
| `@etherpad/desktop` | Released | [`packages/desktop`](packages/desktop) |
| `@etherpad/shell` | Source-consumed workspace dep | [`packages/shell`](packages/shell) |
| `@etherpad/mobile` | Capacitor scaffold (stub Platform; persistence and native plugins pending) | [`packages/mobile`](packages/mobile) |

## Quick start (desktop)

```bash
pnpm install
pnpm dev
```

See [`packages/desktop/README.md`](packages/desktop/README.md) for full developer documentation.

## Layout

- `packages/desktop/` — Electron app (Linux AppImage, deb, snap; macOS DMG; Windows NSIS).
- `packages/shell/` — React renderer shell shared between desktop and mobile. Owns dialogs, state, i18n, and the `Platform` injection seam.
- `packages/mobile/` — Capacitor 8 Android (and iOS-ready) app. Vite-built, wraps `@etherpad/shell` via `createCapacitorPlatform()`. `pnpm mobile:dev` for a browser preview; `pnpm mobile:android:run` for an attached device/emulator.
- `docs/` — specs, plans, and shared internal docs.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
