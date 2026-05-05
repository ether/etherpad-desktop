# Etherpad Desktop

Native desktop client for [Etherpad](https://etherpad.org/) — a multi-workspace
thin client with per-workspace session isolation, a navigable pad sidebar, and
the keyboard shortcuts you'd expect from a modern app.

> Built with Electron 41 + electron-vite + Vite 7 + React 19 + Zustand 5 +
> TypeScript strict end-to-end. Apache-2.0, matching upstream Etherpad.

> [!NOTE]
> **Status: Linux-first MVP.** AppImage, `.deb`, and Snap are the launch
> targets. Windows and macOS builds are on the roadmap once the Linux release
> stabilises.

![Etherpad Desktop main window with two workspaces, sidebar, and an open pad](docs/images/screenshot-main.png)

> _Drop a screenshot at `docs/images/screenshot-main.png` to replace this
> caption — main window with the rail, pad sidebar, and an open pad._

![Quick switcher with fuzzy content search](docs/images/screenshot-quick-switcher.gif)

> _And a short GIF at `docs/images/screenshot-quick-switcher.gif` showing
> Ctrl+K opening the quick switcher and `monki` matching `monkey` via fuzzy
> search._

---

## Why use Etherpad Desktop instead of a browser tab?

- **Per-workspace isolation.** Each Etherpad server you add gets its own
  session partition (cookies, localStorage, IndexedDB). Your work-pads and
  community-pads stay logged in independently — switching workspaces never
  signs you out of either.
- **Multi-pad workflow inside one window.** Tabs, like a browser, but only for
  pads. `Ctrl+W` closes a pad without quitting the app.
- **Cross-workspace fuzzy search.** Quick switcher (`Ctrl+K` / `Ctrl+F`)
  searches pad names AND pad content across every workspace at once. Typo-
  tolerant: `monki` finds `monkey`.
- **Stays out of your way.** Minimise to the system tray, focus mode that
  hides the rail and sidebar to give the pad full width, dark/light/auto
  theme that follows your OS.
- **Real auto-update.** AppImage and `.deb` users get electron-updater
  notifications; Snap users get the channel they subscribed to (edge or
  stable).

## Features

### Workspaces

- Add multiple Etherpad server URLs as named workspaces, each with its own
  colour and isolated session partition (`persist:ws-<uuid>`).
- Rename, recolour, change the URL, or remove a workspace from
  Settings → Workspaces. Removing a workspace clears its session storage,
  history, and any open tabs.
- Workspaces persist across restarts; the rail icons render in the order you
  set.

### Pads

- "+ New Pad" or `Ctrl+T` opens a pad by name. Same name in two workspaces
  produces two independent tabs.
- Each pad runs in its own native `WebContentsView`, isolated by the
  workspace partition. Cookies, localStorage, IndexedDB persist per workspace
  — verified by a regression suite (see `tests/e2e/pad-localstorage-persistence.spec.ts`).
- The pad sidebar shows recent pads and lets you pin favourites (★).
- The URL passed to Etherpad includes `?lang=…&userName=…` so the pad UI is
  localised and your name is pre-filled. This is honoured both for newly
  opened pads and for tabs restored after a quit.

### Tabs and keyboard shortcuts

- Tab strip across the top, drag-to-reorder coming.
- `Ctrl+W` close pad. `Ctrl+T` new pad. `Ctrl+,` settings. `Ctrl+R` reload
  the active pad. `Ctrl+Shift+R` reload the shell.
- `Ctrl+K` or `Ctrl+F` opens the quick switcher.
- `Ctrl+1`…`Ctrl+8` jumps to the Nth pad of the active workspace.
  `Ctrl+9` jumps to the LAST pad — matches Chrome / Firefox.
- `Esc` closes any open dialog (except the first-run "Add a Workspace"
  modal, which is dismissable=false on purpose).

### Quick switcher

- Searches pad NAMES across all workspaces and pad CONTENT (downloaded via
  Etherpad's `/p/<name>/export/txt` endpoint and indexed in memory).
- Three matching tiers, in order: direct substring → token-prefix →
  one-edit-distance fuzzy. So `monki` matches `monkey`.
- Arrow keys + Enter to navigate; `Esc` dismisses.

### Settings

- Default zoom, accent colour, theme (light / dark / auto), language
  override, "remember open pads on quit", "minimise to tray", and a
  "Clear all pad history" button.
- Settings → Workspaces lets you edit the name, colour (click the swatch),
  and Etherpad URL of each workspace inline. The colour picker is the
  swatch itself; URL changes commit on blur or Enter, with inline error
  messaging for invalid URLs.

### Window and tray

- BaseWindow + WebContentsView per pad, repositioned by the main process
  when the rail collapses so "focus mode" actually fills the freed space
  (no black void).
- Window state — bounds, active workspace, open tabs — is restored on
  next launch.
- System tray icon (white silhouette of the Etherpad logo) with
  Show / Quit context menu. Closing the last window minimises to tray
  when the setting is on; the tray's Quit really quits.

### Theming and i18n

- Light / dark / auto themes with `prefers-color-scheme` support.
- All user-facing strings go through an i18n proxy (`t.<section>.<key>`)
  with placeholder substitution via `fmt()`. Adding a locale is a matter of
  dropping a new file matching the `Strings` type — the dictionary shape
  is pinned by tests.
- The HTML root's `lang` attribute follows the active language so screen
  readers announce in the right voice.

### Accessibility

- Every dialog uses `role="dialog"` + `aria-modal="true"` +
  `aria-labelledby`, with focus trap + focus restoration on close.
- Buttons across the rail, sidebar, tab strip, and dialogs carry
  `aria-label` and `title`.
- Focus-visible outlines wired on the rail-collapse handle and sidebar
  action buttons.

### Auto-update and packaging

- electron-updater integrated for AppImage + `.deb` (publishes via GitHub
  Releases on tag push).
- Snap publishing wired with a manual gate before stable promotion (the
  snap-publish workflow first ships to `edge` automatically; promotion to
  `stable` is held behind a GitHub Environment with required reviewers).
- `release-please` opens a "release vX.Y.Z" PR on every push to `main`,
  bumping `package.json` + writing `CHANGELOG.md` based on conventional
  commits. Merging that PR creates the tag, which triggers
  `release.yml` + `snap-publish.yml` automatically.

---

## Keyboard shortcuts (cheat-sheet)

| Action | Shortcut |
|---|---|
| New Pad | `Ctrl+T` |
| Close Pad | `Ctrl+W` |
| Reload Pad | `Ctrl+R` |
| Reload Shell | `Ctrl+Shift+R` |
| Settings | `Ctrl+,` |
| Quick Switcher | `Ctrl+K` or `Ctrl+F` |
| Switch to pad N (1-8) | `Ctrl+1` … `Ctrl+8` |
| Switch to last pad | `Ctrl+9` |
| Dismiss dialog | `Esc` |
| Quit | `Ctrl+Q` |

On macOS, swap `Ctrl` for `Cmd`. Both modifiers are accepted globally.

---

## Install (Linux)

Download the latest release from
[Releases](https://github.com/ether/etherpad-desktop/releases):

### AppImage (single-file, no install)

```bash
chmod +x Etherpad-Desktop-<version>.AppImage
./Etherpad-Desktop-<version>.AppImage
```

### `.deb` (Debian / Ubuntu / Mint)

```bash
sudo apt install ./etherpad-desktop_<version>_amd64.deb
etherpad-desktop
```

### Snap (once on the Snap Store)

```bash
sudo snap install etherpad-desktop
```

The snap auto-updates from the channel you subscribe to (`edge` for nightly,
`stable` for tagged releases).

---

## Develop

Requires Node 22+ and `pnpm` 10+ (the version is pinned via `packageManager`
in `package.json`).

```bash
pnpm install
pnpm dev          # run in dev mode (Electron + Vite HMR)
pnpm test         # vitest — unit + component tests
pnpm test:e2e     # Playwright Electron — end-to-end against the in-process
                  # mock Etherpad fixture
pnpm typecheck    # tsc -b across all four leaf tsconfigs
pnpm lint         # ESLint over src + tests
pnpm format       # Prettier write
pnpm package      # build AppImage + deb into release/
```

After main-process source changes, **restart `pnpm dev`** — Vite's HMR only
covers the renderer. Main + preload changes need a full restart.

### How to know what to change where

- **Renderer UI / dialogs / sidebar / tab strip** — `src/renderer/`. HMR
  picks up changes automatically.
- **Main-process windows / tabs / IPC handlers / lifecycle** — `src/main/`.
  Restart `pnpm dev`.
- **Shared types and Zod payload schemas** — `src/shared/`. Both
  processes consume these.
- **Preload bridge (`window.etherpadDesktop` API surface)** —
  `src/preload/index.ts`. Restart `pnpm dev`.

For the full architecture rationale, see
[`docs/superpowers/specs/2026-05-03-etherpad-desktop-linux-mvp-design.md`](docs/superpowers/specs/2026-05-03-etherpad-desktop-linux-mvp-design.md).

For day-to-day AI-pairing guide, see [`AGENTS.md`](AGENTS.md). Claude-specific
notes are in [`CLAUDE.md`](CLAUDE.md).

---

## Roadmap

The current Linux MVP is what's shipped above. The list below is what comes
next, in roughly the order it'll be tackled. Not all of these are committed;
some are signals of intent.

### Soon

- **Permission UX upgrade.** Today the desktop pre-allows the narrow set of
  permissions Etherpad plugins need (camera/mic for `ep_webrtc`, fullscreen,
  clipboard, screen-share). The next iteration will add a deny-by-default
  prompt-on-request flow with persisted decisions per workspace+origin so
  untrusted Etherpad URLs are safe to add.
- **Real embedded Etherpad server.** A "Use a local Etherpad server" toggle
  used to live in the Add-Workspace dialog but was removed because the
  underlying spawn path was broken (`etherpad-lite@latest` doesn't exist on
  npm). The replacement clones `ether/etherpad@vX.Y.Z`, runs `pnpm install`
  + build, and starts via `node`, with a "Manage instance" link that opens
  Etherpad's `/admin` UI in a tab so plugins like `ep_webrtc` can be
  installed there.
- **Tray icon theme adaptation.** White silhouette reads great on dark
  trays but disappears on light ones. Detect `nativeTheme` and ship a
  black-silhouette variant for light trays.
- **Drag-tab-to-reorder** in the tab strip.
- **Drag-tab-to-tear-off** into a new window.

### Later

- **Windows and macOS builds.** `electron-builder` already supports both;
  the holdouts are code-signing certificates and per-platform packaging
  decisions (MSI vs NSIS on Windows; .dmg/.pkg on macOS).
- **Offline editing / local pad cache.** When a workspace is unreachable,
  open the most recently cached version of pads and queue local edits for
  replay when the server returns.
- **`etherpad-app://` deep-link handler.** Scheme is already registered;
  the handler bodies are stubs. Implementing them gives "open this pad in
  the desktop app" links from a browser.
- **Native OS notifications.** Pad mentions, presence, etc.
- **Self-signed-cert trust UX.** For local Etherpad instances on
  HTTPS-with-self-signed-cert.

---

## Tests

Two layers, both run in CI on every push:

| Layer | Runner | What it covers |
|---|---|---|
| Unit + component | Vitest | Main-process modules (stores, IPC handlers, validation, embedded server, tray, lifecycle). Renderer components (dialogs, rail, sidebar, tab strip) via Testing Library + jsdom. i18n shape contract. |
| End-to-end | Playwright Electron | Full app launches against an in-process mock Etherpad fixture. Workspace add/remove, tab open/close/switch, partition isolation, dialog dismissal, focus trap, rail collapse, scroll-with-50-pads, scroll-with-30-workspaces, restore-on-relaunch, pad localStorage persistence, keyboard shortcuts. |

The E2E fixture uses a tiny in-process HTTP server that returns the JSON
shape Etherpad's `/api/` endpoint speaks; tests verify shell behaviour, not
the editor itself. If port 9003 is already serving an Etherpad-shaped
response (e.g. you've got the etherpad snap installed locally), the fixture
will use that as-is instead of binding the port.

---

## License

Apache-2.0. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).

This project is a thin client; the Etherpad server it talks to is upstream
software with its own license and contributors. Etherpad is at
<https://github.com/ether/etherpad>.
