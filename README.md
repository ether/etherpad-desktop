# Etherpad apps

Cross-platform clients for [Etherpad](https://etherpad.org/) — a single codebase
that ships as an Electron desktop app **and** a Capacitor Android app, both
running the same React shell.

This is a pnpm monorepo.

| Package | Status | Source |
|---|---|---|
| `@etherpad/desktop` | v0 beta — Linux (AppImage / `.deb` / Snap), Windows (NSIS / portable), macOS (DMG arm64+x64). Auto-update on Linux + Windows. | [`packages/desktop`](packages/desktop) |
| `@etherpad/mobile` | Beta — Android debug APK runs; iOS scaffold present, not yet exercised. Not on Play Store yet. | [`packages/mobile`](packages/mobile) |
| `@etherpad/shell` | Workspace dep consumed as source by both apps. Owns React tree, state, i18n, IPC channel schemas, the `Platform` injection seam. | [`packages/shell`](packages/shell) |

## Goal

**One UX, two shells.** The instance rail, pad tabs, sidebar, dialogs, settings,
keyboard model, theming, and i18n live in `@etherpad/shell` and render
identically on desktop and mobile. Each runtime injects a `Platform`
implementation that handles native concerns (window management, persistence,
deep links, permissions) behind a typed IPC seam.

The one place we expect to **diverge** is offline editing — a desktop client
usually has a long-lived connection, where a mobile client is offline by
default. Mobile will likely grow a CRDT-based local-edit-queue path that
desktop doesn't need; both will keep using Etherpad's OT-based collaboration
when online.

## Quick start

```bash
pnpm install
pnpm dev               # desktop: Electron + Vite HMR
pnpm mobile:dev        # mobile: browser preview at http://localhost:5173/
pnpm mobile:android:run # mobile: build + sync + run on attached device/emulator
pnpm test              # vitest across all packages
pnpm test:e2e          # Playwright Electron e2e + mobile smoke
pnpm typecheck         # tsc -b across the monorepo
```

Per-app developer docs:

- [`packages/desktop/README.md`](packages/desktop/README.md) — install one-liners, install matrix, dev loop, packaging.
- [`packages/mobile/README.md`](packages/mobile/README.md) — Capacitor / Android toolchain, build + adb.

## Feature parity

This is the canonical "what works where" view. Empty cells mean **not started**;
"⏳" means in flight; "✅" means shipped on that surface.

### Etherpad instances and workspaces

| Feature | Desktop | Mobile |
|---|---|---|
| Multiple Etherpad instances, isolated sessions | ✅ | ✅ |
| Per-instance colour + name + URL editing | ✅ | ✅ |
| Reorder instances in the rail | ✅ | ✅ |
| Embedded local Etherpad server (no internet needed) | ✅ | ❌ phones don't ship Node; spec divergence noted below |
| HTTP basic-auth challenge dialog | ✅ | ❌ planned |

### Pads, tabs, navigation

| Feature | Desktop | Mobile |
|---|---|---|
| Open pad by name into a new tab | ✅ | ✅ |
| Multiple pads per instance, switchable tabs | ✅ | ✅ |
| Auto-collapse rail when opening a pad (focus mode) | ✅ | ✅ |
| Tap pad to dismiss the rail (drawer behaviour) | n/a | ✅ |
| Restore open tabs + active pad across app restarts | ✅ | ✅ |
| Restore rail-collapsed state across app restarts | ✅ | ✅ |
| Native pad rendering (WebContentsView vs iframe) | WebContentsView | iframe |
| Pad sidebar — Recent + Pinned + search | ✅ | ✅ |
| Cross-instance fuzzy quick switcher (Ctrl+K) | ✅ name + content search | ✅ name search; content search ⏳ |
| Pad-history persistence per workspace | ✅ | ✅ |
| `?lang=…&userName=…` threaded into pad URL | ✅ | ✅ |

### Deep links and integration

| Feature | Desktop | Mobile |
|---|---|---|
| `etherpad-app://` deep-link scheme | ✅ registered, partial handler | ✅ |
| Open pad by URL dialog | ✅ | ✅ |
| Receive shared URL from another app | n/a | ✅ Android share intent |
| "Open in browser" escape for blocked / X-Frame-DENY pads | n/a | ✅ |

### Settings, theming, i18n

| Feature | Desktop | Mobile |
|---|---|---|
| Light / dark / auto theme | ✅ | ✅ |
| Default zoom override | ✅ | ✅ |
| Accent colour override | ✅ | ✅ |
| User display name pre-fill | ✅ | ✅ |
| "Remember open pads on quit" toggle | ✅ | ✅ |
| Confirmation dialog before "Clear all pad history" | ✅ | ✅ |
| Shell strings translated (en, es, fr, de, pt/pt-br, it) | ✅ | ✅ |
| Pad-iframe locale via `?lang=` (115 etherpad-core locales) | ✅ | ✅ |
| HTML root `lang` attribute follows active locale | ✅ | ✅ |

### Keyboard, gestures, window

| Feature | Desktop | Mobile |
|---|---|---|
| Keyboard shortcuts (`Ctrl+T` / `Ctrl+W` / `Ctrl+K` / `Ctrl+1..9` / `Ctrl+,`) | ✅ | n/a |
| Swipe gesture between pads | n/a | ✅ |
| Android back button collapses → switches → exits | n/a | ✅ |
| Window bounds + active workspace restored on relaunch | ✅ | n/a |
| Minimise-to-tray | ✅ | n/a |
| Tray icon (B&W silhouette, theme-adaptive ⏳) | ✅ | n/a |

### Permissions and security

| Feature | Desktop | Mobile |
|---|---|---|
| Per-instance isolated session partition | ✅ `persist:ws-<uuid>` | ✅ Capacitor Preferences keyed by workspace id |
| Permission pre-allow for `ep_webrtc` plugins (cam/mic/fullscreen/clipboard/screen) | ✅ narrow allowlist | ⏳ Phase 6b native plugin (camera/mic delegation) |
| Deny-by-default with prompt-on-request, persisted decisions | ⏳ planned | ⏳ planned |
| HTTPS-with-self-signed-cert trust UX | ⏳ planned | ⏳ planned |

### Packaging, distribution, updates

| Feature | Desktop | Mobile |
|---|---|---|
| Linux AppImage + `.deb` + Snap | ✅ | n/a |
| Windows NSIS installer + portable `.exe` | ✅ unsigned | n/a |
| macOS DMG (arm64 + x64) | ✅ unsigned | n/a |
| Android signed release APK + Play Store listing | n/a | ⏳ |
| iOS build | n/a | scaffold present, not built |
| `release-please` conventional-commits release flow | ✅ | shared release flow planned |
| In-app auto-update | ✅ electron-updater (AppImage + `.deb` + Windows NSIS) | n/a — store handles updates |
| Snap channel publishing (`edge` auto, `stable` gated) | ✅ | n/a |

### Tests and CI

| Feature | Desktop | Mobile |
|---|---|---|
| Vitest unit + component tests | ✅ | ✅ shared with shell |
| Playwright Electron e2e | ✅ against in-process mock Etherpad | n/a |
| Playwright web smoke (vite preview) | n/a | ✅ |
| Android emulator click-through smoke (uiautomator) | n/a | ✅ scaffolded |
| CI runs on every PR (lint / typecheck / unit / e2e) | ✅ | ✅ |

## What's next

Roughly in the order it'll be tackled. Items that apply to one shell are
marked; everything else lands on both.

### Soon

- **Mobile permissions plugin (Phase 6b)** — native Kotlin delegation for
  camera, mic, clipboard, fullscreen, file picker so `ep_webrtc` and friends
  work inside the WebView on Android.
- **Desktop permission UX upgrade** — replace the narrow pre-allow with a
  deny-by-default prompt-on-request flow, decisions persisted per
  instance+origin. Same UI ships to mobile after Phase 6b lands.
- **Mobile content search in quick switcher** — desktop already indexes pad
  bodies via `/export/txt`. Mobile stubs that path; wire it.
- **Mobile Play Store release** — signed AAB, store listing, edge / stable
  channels mirroring the Snap split.
- **Cross-pad content search on mobile** — see above.
- **Tray icon theme adaptation (desktop)** — detect `nativeTheme`, ship a
  black-silhouette variant for light trays.

### Later

- **Offline editing — diverges between shells.** Desktop usually has a
  long-lived connection; mobile is offline by default. Working assumption:
  desktop gets a cache-then-OT-replay path; mobile gets a CRDT-based local
  edit queue with sync-on-reconnect. Both surface the same UX (greyed
  "offline" banner, queued-edit indicator) but the engines differ. Spec work
  in flight.
- **Native OS notifications** — pad mentions, presence.
- **Drag-tab-to-reorder + tear-off-into-new-window** (desktop).
- **HTTPS-with-self-signed-cert trust UX** — applies to both, more useful on
  desktop where users add local Etherpad URLs.

### Explicit non-goals

- **No code-signing fees.** Windows + macOS will continue shipping unsigned
  binaries — SmartScreen / Gatekeeper warn on first run; both work fine
  afterwards. Apple's $99/yr Developer ID and Microsoft's EV / Azure Trusted
  Signing programs gate independent open-source software behind a recurring
  tax we won't pay. Forks / distributors / enterprises are welcome to roll
  their own signed builds under Apache-2.0.

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

This project is a thin client; the Etherpad server is upstream software with
its own license and contributors. Etherpad is at
<https://github.com/ether/etherpad>.
