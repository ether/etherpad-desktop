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

## Fork it, brand it, ship it (white-label)

The code is Apache-2.0. If you want to ship Etherpad apps under your own
brand — your name on the home screen, your icon, your accent colour, your
GitHub Releases feed — clone, edit one JSON file, and build.

```bash
git clone https://github.com/ether/etherpad-desktop.git mypad && cd mypad
pnpm install
cp brand.example.json brand.json
# edit brand.json: name, appId, androidPackage, accent, description, …
pnpm white-label
pnpm package                 # desktop installers in release/
pnpm mobile:android:run      # mobile APK on attached device/emulator
```

`pnpm white-label` rewrites every identity-bearing field across
`electron-builder.yml`, `capacitor.config.ts`, the Android Gradle and
`strings.xml`, the shell i18n, and the CSS accent token. Re-runnable —
no state leaks between invocations. CLI flags override `brand.json` for
ad-hoc builds: `pnpm white-label --name FooPad --accent '#ff5500'`.

**Icons stay manual for v1.** The script reports which PNGs to replace:

- `packages/desktop/build/icons/icon-{16,32,64,128,256,512}.png`
- `packages/desktop/build/icons/icon.{ico,icns}`
- `packages/mobile/android/app/src/main/res/mipmap-*/ic_launcher*.png`

Drop your own assets in at those paths before `pnpm package` /
`pnpm mobile:android:run`.

**Code signing is on you.** We don't sign upstream releases (Apple's
$99/yr Developer ID and Microsoft's EV cert programs gate independent
open-source software behind a recurring tax we won't pay). A fork that
wants warning-free first launches signs with its own credentials. The
build config has `mac.identity: null` and `win.signAndEditExecutable:
false` by default — flip those to your own creds when you're ready.

**Publishing is on you too.** Point `brand.json.publish.{owner,repo}` at
your own GitHub repo; electron-updater will look for new releases there.
Mirror `.github/workflows/release.yml` or use whatever distribution
channel you prefer.

`brand.json` is gitignored so your local branding doesn't leak into
upstream PRs.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
