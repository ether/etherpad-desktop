# Etherpad Mobile (Android first, iOS-ready) — design

**Status:** draft, approved in brainstorming on 2026-05-11
**Author:** John McLear
**Primary distribution:** F-Droid
**Repo:** restructure of `etherpad-desktop` → `etherpad-apps` (pnpm monorepo)

## 1. Goals & non-goals

### Goals (v1)

- Native-feeling Android app for Etherpad with **full feature parity** to `etherpad-desktop`, adapted for touch and narrow viewports.
- **Maximum code reuse** with the desktop app — React shell, Zustand stores, i18n, types, validation, and Zod schemas are shared verbatim.
- **iOS-ready** from the same codebase via Capacitor's existing iOS support. iOS build is *designed for* but not delivered in v1.
- **F-Droid distribution** as the canonical channel. Fully FOSS dependency tree, no Google Play Services, no tracking, reproducible build target.
- **Forkable / re-skinnable / monetizable downstream**: third parties can fork and ship on Play Store / App Store with their own branding and pricing. The repo stays a clean upstream.

### Non-goals (v1)

- Per-workspace cookie isolation on mobile. The single shared WebView means iframes coexist in one cookie jar; documented as a v2 item.
- Embedded local Etherpad server on mobile (desktop has it; mobile cannot run Node).
- Push notifications.
- Tablet-specific layouts beyond what responsive design gives us.
- Auto-update logic (F-Droid handles).

### v2 (explicit, planned)

- **Embedded local Etherpad server on mobile** with offline editing and **sync on connection restoration**. Likely via `nodejs-mobile` or a CRDT-backed offline queue — approach decided when we get there.
- **Push notifications** for pad activity (mentions, collaboration invites, etc.).
- Per-workspace cookie isolation via custom native WebView plugin.
- iOS GA.

## 2. Stack

- **Capacitor 6+** as the cross-platform shell. Renderer runs in the native WebView (Android WebView / WKWebView), bridged to a thin native layer.
- **React 19 + Zustand 5** carried over from `etherpad-desktop`.
- **TypeScript strict** end-to-end.
- **Zod** schemas at every storage and event boundary.
- **pnpm workspaces** for the monorepo.

Capacitor was chosen over React Native (which would have required rewriting all `div`/`span` UI as `View`/`Text`), Flutter / KMP (no React reuse), and Tauri Mobile (less mature mobile support, weaker F-Droid track record).

## 3. Monorepo layout

Existing `etherpad-desktop` is restructured **in place** into a pnpm workspace and the repo is renamed to `etherpad-apps`. Git history, issues, and release tags are preserved.

```
etherpad-apps/
├── packages/
│   ├── shell/                # @etherpad/shell
│   │   └── src/
│   │       ├── components/ dialogs/ rail/ sidebar/ tabs/ state/
│   │       ├── i18n/ ipc/ types/ validation/ url.ts App.tsx
│   │       ├── platform.ts            # Platform interface (the seam)
│   │       └── responsive/            # breakpoint hooks, drawer overlays
│   ├── desktop/              # @etherpad/desktop (Electron)
│   │   └── src/{main,preload,renderer}
│   └── mobile/               # @etherpad/mobile (Capacitor)
│       ├── src/
│       │   ├── main.tsx              # mounts <App /> with CapacitorPlatform
│       │   ├── platform/             # CapacitorPlatform impl
│       │   └── mobile-overrides/     # PadIframeStack and similar mobile-only views
│       ├── android/                  # Capacitor Android project (Gradle)
│       ├── ios/                      # Capacitor iOS project (Xcode)
│       └── capacitor.config.ts
├── pnpm-workspace.yaml
├── package.json                       # root scripts, no production deps
└── docs/                              # specs, plans, smoke tests
```

- The currently-empty `/home/jose/etherpad/etherpad_android/` becomes the seed for `packages/mobile/` during the migration PR.
- Versioning is independent per package. Tags: `desktop-vX.Y.Z`, `mobile-vX.Y.Z`. Shell uses workspace `*` references and ships only as a workspace dep (not published to npm in v1).
- Existing CI workflows move under `.github/workflows/desktop-*.yml`. New `mobile-release.yml` builds APK + IPA on `mobile-v*` tags.

## 4. Platform abstraction

The shell does **not** import `electron` or `@capacitor/*`. It depends on a single `Platform` interface that each runtime wires up at boot.

```typescript
// packages/shell/src/platform.ts
export interface Platform {
  storage: KeyValueStore;            // workspaces, pad history, settings, window state
  padView: PadViewController;        // open/close/show/hide pad surfaces
  events: EventBus;                  // typed pub/sub mirroring shared/ipc/channels.ts
  app: AppLifecycle;                 // quit, minimize, focus, version
  share: ShareIntent;                // share pad URL / text via system share
  permissions: PermissionsBroker;    // media (camera/mic)
  deepLinks: DeepLinkSource;         // initial URL + onUrlOpen subscription
}
```

- **Desktop impl** (`packages/desktop/src/renderer/platform.electron.ts`) wraps the existing `window.etherpadDesktop` preload bridge. `padView` calls IPC into the main-process TabManager; `storage` delegates to electron-store via IPC.
- **Mobile impl** (`packages/mobile/src/platform/platform.capacitor.ts`) uses:
  - `@capacitor/preferences` for small KV (workspaces, settings).
  - `@capacitor/filesystem` for larger blobs (pad history, window state).
  - `@capacitor/share`, `@capacitor/browser`, `@capacitor/app`.
  - In-process `mitt` for events (single window — no IPC).
  - `PadIframeStack` for `padView` (DOM iframes; bounds are ignored).
  - Custom `PadWebviewPermissionsPlugin` for camera/mic delegation.

Same Zod schemas in `packages/shell/src/validation/` gate every payload crossing the seam, on both runtimes.

The shell's existing `src/renderer/ipc/api.ts` collapses into a `usePlatform()` hook that returns the injected `Platform`. `App.tsx` becomes platform-agnostic; the platform-specific `index.tsx` files wire the runtime impl and render `<App />`.

## 5. Pad rendering on mobile

The desktop `TabManager` (main process, native WebContentsViews) is replaced on mobile by a renderer-side `<PadIframeStack>` that preserves the same invariants.

```tsx
<main-area>
  <PadIframeStack>
    {openTabs.map(t => (
      <iframe
        key={t.id}
        src={padUrlFor(t)}                    // includes ?lang=<code>
        data-pad-id={t.id}
        style={{ display: (t.id === activeTabId && !dialogOpen) ? 'block' : 'none' }}
      />
    ))}
  </PadIframeStack>
</main-area>
```

**Invariants preserved from desktop:**

- Exactly one iframe is visible at a time = the active tab.
- When a dialog is open, all iframes are hidden so the dialog (in shell DOM) paints unobstructed.
- Iframes stay mounted while their tab is open; switching tabs is instant and websocket state survives.

**Language switching:** load with `?lang=<code>`; on language change re-set `iframe.src` with the new URL (mirrors desktop's `webContents.loadURL` rule).

**X-Frame-Options DENY fallback:** detect on iframe load failure and fall back to `@capacitor/browser` (in-app system browser) for that pad. Show a "this server refuses to embed; open in browser?" dialog.

**iframe.sandbox is NOT set** — Etherpad needs same-origin behavior. The user's own server's CSP is the security boundary.

## 6. State, storage, and events

State management stays Zustand; what changes is how it persists.

- Each store has a `StoreDefinition` in `shell` with a key, Zod schema, and default. Read/write go through `platform.storage`. The Zustand store wraps that with caching and change notifications.
- **Desktop runtime** routes `platform.storage` to the existing electron-store IPC bridge. Main-process-authoritative; behavior unchanged.
- **Mobile runtime** routes to `@capacitor/preferences` (small keys) and `@capacitor/filesystem` JSON (large keys). Renderer writes directly — no main process exists on mobile. Zod runs at the boundary on both runtimes.
- **Events** (`src/shared/ipc/channels.ts`, now renamed conceptually to "platform events") flow through `platform.events`. Desktop bridges to Electron IPC; mobile uses an in-process EventEmitter. Renderer subscription code in `App.tsx` doesn't branch.
- **Schema versioning:** every persisted blob has a `schemaVersion` field. Migration functions live in `shell` and run on both runtimes. Designed-for cross-runtime export/import (not delivered in v1).

## 7. Permissions, deep linking, system integration

### Permissions (camera/mic for plugins like `ep_webrtc`)

Android WebView denies permission requests by default — same problem desktop already solved via `session.setPermissionRequestHandler`. Off-the-shelf Capacitor plugins don't cover WebView permission delegation, so we ship a small custom plugin:

- **Android:** `PadWebviewPermissionsPlugin` overrides `WebChromeClient.onPermissionRequest`, maps `VIDEO_CAPTURE`/`AUDIO_CAPTURE` to runtime `CAMERA`/`RECORD_AUDIO`, prompts via standard Android dialog, grants/denies the WebView request.
- **iOS:** uses `WKUIDelegate.requestMediaCapturePermissionFor` (iOS 15+).
- Renderer sees `platform.permissions.requestMedia()`.

No notifications, contacts, or location in v1.

### Deep linking

- Custom scheme `etherpad://` plus HTTPS app links for user-configured workspace domains.
- AndroidManifest: `<data android:scheme="https" android:pathPattern="/p/.*" android:autoVerify="true"/>`. iOS Universal Links wired but not GA'd in v1.
- Flow:
  1. Capacitor `appUrlOpen` lands in `platform.deepLinks.onUrlOpen(handler)`.
  2. Parse pad URL → `(serverOrigin, padId)`.
  3. Match against existing workspaces by origin. Found → open the pad in that workspace.
  4. Not found → prompt "Add `<origin>` as a workspace?" using the existing `AddWorkspaceDialog`.

### System share

- "Share pad URL" from tab context menu → `platform.share.url(padUrl)` → `@capacitor/share`.
- "Open in external browser" → `@capacitor/browser`.

### Android back button

Hardware back closes dialogs first, then pops a tab, then minimizes the app (no quit-on-back — Android convention). Wired via `@capacitor/app`'s `backButton`.

### App lifecycle

`focus`/`blur`/`appStateChange`/`pause`/`resume` map to existing shell lifecycle hooks via `platform.app`.

## 8. Responsiveness work in shell

The desktop shell is mostly responsive but needs two adjustments for mobile feel (both also benefit narrow desktop windows):

- **Workspace rail → bottom-drawer (or slide-in) at < 768px.** The persistent left rail becomes a hamburger that opens a workspace drawer. Reuses existing collapse logic plus a new breakpoint hook.
- **Tab bar → horizontally scrollable with an overflow menu on narrow.** Desktop wraps; mobile uses single-line scroll plus a "more tabs" overflow.

Touch hit targets (min 44×44px), font scaling for accessibility, and safe-area insets (notches, gesture bars) are part of this work too.

## 9. Distribution

### F-Droid (primary)

- F-Droid metadata at `metadata/com.etherpad.mobile.yml`. F-Droid's `fdroidserver` clones the repo, runs the build, signs with their key.
- **Fully FOSS dependency tree.** No Google Play Services, no Firebase, no Crashlytics, no ads, no analytics. Capacitor core + the small plugin set listed in §4. Custom permissions plugin lives in-repo.
- **No tracking, no telemetry.** Local logging only, off by default.
- **Anti-features:** none by default. The app ships with zero pre-configured workspaces; the user adds their own. If a downstream fork pre-configures a non-FOSS server, that fork must declare `NonFreeNet`.
- **Reproducible build target:** pin JDK 17, Gradle, Android Gradle Plugin, Capacitor major, every plugin version. Document the exact build command in `packages/mobile/README.md`. F-Droid compares hashes.
- **Signing:** F-Droid signs their own builds. Repo's GitHub releases ship unsigned (or dev-signed for testing).

### Play Store / App Store (downstream forks)

- Documented, not run from this repo. README explains how to fork, swap application ID, sign with own keystore, submit.
- `packages/mobile/android/app/build.gradle` uses a `flavor` block so `applicationIdSuffix` and app name can be swapped without code edits.

### CI / release

- New workflow `.github/workflows/mobile-release.yml` triggered on `mobile-vX.Y.Z` tags. Builds debug + release APK. Attaches APK + IPA to GitHub release. F-Droid's bot picks up the tag.
- Existing desktop workflows renamed but unchanged in behavior.

## 10. Testing strategy

- **Shell unit tests** (vitest): one suite at the package level. No Electron or Capacitor mocks needed — tests inject a mock `Platform`.
- **Desktop tests** (existing, in `packages/desktop`): vitest for main/renderer, Playwright Electron for E2E. Unchanged.
- **Mobile tests** (in `packages/mobile`): vitest for renderer-specific components (with a Capacitor mock `Platform`). Maestro or Detox for native E2E (deferred to phase 5+).
- **No duplicate tests** — any logic in `shell/` is tested once at `shell/` level. Per-runtime tests only cover runtime-specific glue (electron-store IPC, Capacitor plugin bridges).
- Backend (`packages/desktop/src/main/`) and renderer test suites both run in CI per the existing convention.

## 11. Migration phases

Each phase ends with desktop fully working and CI green. Phases land as separate PRs.

1. **Workspace conversion.** `etherpad-desktop` → pnpm workspace. Move source to `packages/desktop/src/`. Rename repo to `etherpad-apps`, rename `feat/linux-mvp` to a new working branch. Desktop tests/E2E/CI green. No functional change.
2. **Extract `@etherpad/shell`.** Move `src/renderer/` + `src/shared/` into `packages/shell/`. Add the `Platform` interface and the Electron platform impl. `App.tsx` becomes runtime-agnostic. Desktop tests still green.
3. **Bootstrap `@etherpad/mobile`.** Capacitor scaffold, Android project, stub `Platform` impl, blank shell mounting in WebView. E2E: app boots, empty workspace state shows.
4. **Mobile storage + state.** Wire `@capacitor/preferences`/`filesystem`. Add a workspace, verify persistence across restarts. Settings page works.
5. **PadIframeStack + tab UX.** Open pad → iframe loads → tab switch works → dialog hides iframes → X-Frame fallback to `@capacitor/browser`.
6. **Permissions plugin + deep links + share.** Custom permissions plugin lands; `ep_webrtc` smoke test passes. Deep links open pads in the right workspace. System share works.
7. **Mobile responsiveness in shell.** Bottom drawer < 768px, scrollable tab bar, touch-friendly hit targets, safe-area insets.
8. **F-Droid metadata + reproducible build.** Submit to F-Droid. Iterate until build hashes match.

## 12. Known risks and open questions

- **X-Frame-Options on user servers** could block iframe embedding entirely. Mitigation: `@capacitor/browser` fallback per pad. Worst case for affected users: degraded multi-tab UX (the pad is in a system browser, not the shell).
- **Cookie sharing across iframes** — see §1 non-goals. Acceptable for v1; v2 native plugin upgrade path exists.
- **iOS WKWebView differences** are designed-for but not exercised in v1. Risk of late discovery on iOS GA.
- **Reproducible builds for F-Droid** can be finicky — third-party plugin updates can break hash equality. Pinning + a hash-check CI job mitigates.
- **`PadWebviewPermissionsPlugin`** is custom code with native Android + iOS surfaces. Needs unit tests on both platforms; iOS surface is unverified until phase 6.

## 13. Pointers

- Implementation plan: `docs/superpowers/plans/2026-05-11-etherpad-mobile-android.md` (produced from this spec by writing-plans).
- Desktop spec for reference: `docs/superpowers/specs/2026-05-03-etherpad-desktop-linux-mvp-design.md`.
- Desktop AGENTS guide: `AGENTS.md` (current root; moves to `packages/desktop/AGENTS.md` in phase 1).
