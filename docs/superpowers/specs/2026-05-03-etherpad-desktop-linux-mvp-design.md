# Etherpad Desktop — Linux MVP Design

**Status:** Approved (brainstorm 2026-05-03)
**Spec scope:** Spec 1 of a planned series. Covers the Linux desktop MVP only.
**Future specs (out of scope here):** Spec 2 — Linux store distribution (Snap, Flathub). Spec 3 — Windows port. Spec 4 — macOS port. Spec 5 — embedded local Etherpad server (the "B" usage mode). Spec 6 — offline editing.

## 1. Overview

`etherpad-desktop` is a native desktop client for Etherpad. The end goal is that a non-technical user downloads one file, double-clicks it, and lands in an experience that feels like a native application rather than a browser tab.

This MVP is a **thin client**: the app does not bundle Etherpad. The user supplies one or more Etherpad server URLs, and the app provides native chrome (window, menu bar, keyboard shortcuts, OS integration), workspace and pad management, and per-workspace session isolation around webviews pointed at those servers.

**Phasing context:**

- **Spec 1 (this doc):** Linux MVP — multi-server thin client, AppImage + `.deb` distributables.
- **Spec 2:** Snap/Flathub/store submission for Linux.
- **Spec 3 / Spec 4:** Windows / macOS ports.
- **Spec 5:** Embedded Etherpad server (a workspace-of-type-local that runs a bundled server in a child Node process).
- **Spec 6:** Offline editing.

This spec includes targeted, zero-cost architectural prep for Specs 5 and 6 so they slot in cleanly later — see §6 (offline) and §3.5 (embedded-server seam).

## 2. Goals and non-goals

### Goals

- Multi-workspace thin client. Each workspace is one configured Etherpad server URL with its own isolated session (cookies, localStorage, IndexedDB).
- Hybrid pad navigation: per-workspace pad sidebar (recent + pinned) **and** a real navigable webview (URL nav, back/forward).
- Tabs within the main area. `Ctrl+W` closes the active tab; the window remains.
- Native menu bar (File / Edit / View / Window / Help) and standard keyboard shortcuts.
- Per-workspace partition isolation, persisted across restarts.
- Window/tab restoration across app restarts.
- "Remove workspace" wipes its workspace entry, partition, and pad-history entries in a single user action, with the reversible JSON-store changes rolled back on failure (best-effort transactional — the irreversible partition wipe is the last step).
- Linux distributables: AppImage (primary) and `.deb` (secondary), both produced from one `electron-builder` config.
- Apache-2.0 license, matching upstream Etherpad.
- i18n scaffolding present from day one; English-only UI strings at launch.

### Non-goals (v1)

- Bundled Etherpad server (Spec 5).
- Offline editing or local pad cache (Spec 6).
- Auto-update wiring (the metadata file is generated, but `electron-updater` is not enabled).
- Native OS notifications.
- System tray / minimize-to-tray.
- Deep-link (`etherpad-app://…`) handler bodies (the scheme is registered but inert).
- Crash reporting / telemetry.
- Drag-tab-to-tear-off-window (planned later).
- Windows or macOS builds.
- Code signing (Linux v1 ships unsigned AppImage / deb).
- Self-signed-cert trust UX.

## 3. Architecture & process model

### 3.1 Stack

- Electron, latest stable (≥ Electron 30).
- TypeScript end-to-end. Strict mode on. No JS in the source tree.
- Shell renderer: React (matches Etherpad's admin-UI direction; familiar tooling for contributors).
- Persistence: `electron-store` (JSON) for all small structured state. (Schema-versioned; if any file grows past a few thousand entries we revisit `better-sqlite3`. Not in v1.)
- Build: Vite (`electron-vite` template) for both processes.
- Packaging: `electron-builder`.
- License: Apache-2.0.

### 3.2 Process diagram

```
┌──────────────────────────────────────────────────────────────┐
│  Main process (Node, TypeScript)                             │
│  - App lifecycle (single-instance lock, deep-link handler)   │
│  - One BaseWindow per app window                             │
│  - One WebContentsView per open pad tab                      │
│  - Native menu bar, accelerators                             │
│  - IPC hub (typed channels, Zod-validated)                   │
│  - Persistence: workspaces, pad history, settings, windows   │
└────────┬─────────────────────────────────────────┬───────────┘
         │                                         │
         │ IPC (typed)                             │ owns
         ▼                                         ▼
┌────────────────────────┐              ┌──────────────────────┐
│  Shell renderer        │              │  Pad WebContentsView │
│  (one per window)      │              │  (one per open tab)  │
│  - workspace rail      │              │  partition:          │
│  - pad sidebar         │              │    persist:ws-${id}  │
│  - tab strip           │              │  src: pad URL on     │
│  - settings/dialogs    │              │       workspace svr  │
│  - URL/pad-name input  │              └──────────────────────┘
└────────────────────────┘                Positioned by main
                                          process to overlay the
                                          shell's "main area" rect
```

### 3.3 Key choices

1. **`WebContentsView` (modern Electron) over `<webview>` tag.** The shell renderer doesn't host the pad content directly; the main process owns each pad as a `WebContentsView` and tells the window where to place it. This matches Slack/Discord's modern pattern, gives us isolation, and avoids `<webview>`-tag footguns.
2. **Session partitions per workspace, not per pad.** Each workspace gets `partition: 'persist:ws-<uuid>'`. Cookies, localStorage, and any auth survive across pads within a workspace and across app restarts; they are isolated between workspaces. Removing a workspace wipes its partition.
3. **Single-instance lock.** Second launches forward their args (e.g., a deep-link URL — phase 2) to the running instance and exit. Standard Electron `requestSingleInstanceLock`.
4. **Renderer isolation enabled, contextBridge for IPC.** `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`. The shell renderer talks to the main process only through a small typed IPC API exposed by `preload.ts`.
5. **Active workspace is per-window**, but workspace list, pad history, and settings are app-wide. Two windows can show different workspaces. Phase 2's "tear tab off into its own window" becomes re-parenting a `WebContentsView` to a new `BaseWindow`.
6. **Pad views stay alive while their tab is open.** Switching workspace within a window hides/re-shows the relevant `WebContentsView`s; closing a tab destroys its view. Reload-on-switch would be jarring during active editing; memory cost is acceptable.

### 3.4 Custom protocol scaffolding

`etherpad-app://` is registered as a privileged scheme at boot. **No handlers wired in v1.** This exists so that Spec 5 (embedded server) and Spec 6 (offline) can route pad loads through a local handler without an architectural retrofit.

### 3.5 Embedded-server seam

`PadSyncService.resolveSrc(workspaceId, padName)` is the single function the tab manager calls to determine the URL a `WebContentsView` should load. In v1 it returns `${workspace.serverUrl}/p/${encodeURIComponent(padName)}`. In Spec 5 it gains a branch for `workspace.kind === 'embedded'`. In Spec 6 it gains a branch for the offline cache. The tab manager and renderer never need to change.

## 4. Components

Modules organised by process boundary. Each is intended to be small and single-purpose; tests target the modules, not the integration.

### 4.1 Main process (`src/main/`)

| Module | Responsibility |
|---|---|
| `app/lifecycle.ts` | Boot, single-instance lock, ready/before-quit/will-quit hooks |
| `app/menu.ts` | Native menu bar (File / Edit / View / Window / Help) and accelerators |
| `windows/window-manager.ts` | Set of `AppWindow` instances; create / focus / close |
| `windows/app-window.ts` | One `BaseWindow` + its shell renderer + its `TabManager` |
| `tabs/tab-manager.ts` | Per-window: open tabs, owns each pad's `WebContentsView`, positions on resize, handles activate/close |
| `tabs/pad-view-factory.ts` | The single seam where every `WebContentsView` is created. Spec 5/6 install interceptors here. |
| `pads/pad-sync-service.ts` | `resolveSrc` + (later) cache/replay logic. v1: pass-through. |
| `workspaces/workspace-store.ts` | CRUD on workspace list (id, name, server URL, color); persisted via `electron-store` |
| `workspaces/session.ts` | Partition naming (`persist:ws-${id}`), cookie/storage clearing on workspace removal |
| `pads/pad-history-store.ts` | Per-workspace ordered list of pads visited, plus pinned set; capped (200 most-recent unpinned per workspace, FIFO eviction) |
| `settings/settings-store.ts` | App-wide settings (default zoom, accent color, language, `rememberOpenTabsOnQuit`) |
| `state/window-state-store.ts` | Per-window persisted bounds + active workspace + open tabs |
| `ipc/channels.ts` | Single source of truth for IPC channel names + Zod-validated payload types |
| `ipc/handlers.ts` | Wires channels to store/manager methods |
| `logging/logger.ts` | `electron-log` configured with rotation; redaction helpers |

### 4.2 Shell renderer (`src/renderer/`)

| Module | Responsibility |
|---|---|
| `App.tsx` | Root; routes by active workspace + open dialog. Top-level React `ErrorBoundary`. |
| `rail/WorkspaceRail.tsx` | Left rail: workspace icons, "+ add", settings cog |
| `sidebar/PadSidebar.tsx` | Pinned + Recent pads for the active workspace, "+ New Pad" |
| `tabs/TabStrip.tsx` | Tab strip across the top of the main area |
| `dialogs/AddWorkspaceDialog.tsx` | First-run + add. Probes `${serverUrl}/api/` to confirm the URL is reachable and looks like Etherpad before persisting. |
| `dialogs/OpenPadDialog.tsx` | `Ctrl+T` / "Open Pad…" — pad-name field with autocomplete from history, "+ Create new" toggle |
| `dialogs/SettingsDialog.tsx` | App-wide settings UI |
| `state/store.ts` | Zustand store: active workspace id, open tabs, dialog state |
| `ipc/api.ts` | Typed wrapper around the contextBridge API |
| `i18n/index.ts` | Scaffolding for translation. English-only at launch; structure ready to add locales without code changes. |

### 4.3 Preload (`src/preload/`)

| Module | Responsibility |
|---|---|
| `index.ts` | `contextBridge.exposeInMainWorld('etherpadDesktop', api)` — typed IPC surface |

### 4.4 Shared (`src/shared/`)

| Module | Responsibility |
|---|---|
| `types/*` | `Workspace`, `PadHistoryEntry`, `OpenTab`, etc. |
| `validation/*` | Zod schemas for IPC payloads + persisted data |

### 4.5 Build / config (root + `build/`)

| File | Responsibility |
|---|---|
| `build/electron-builder.yml` | Targets, icons, AppImage/deb config, latest-linux.yml output |
| `build/icons/` | Source icons (16, 32, 64, 128, 256, 512, 1024) + ico/icns later |
| `vite.main.config.ts`, `vite.renderer.config.ts` | Build config (electron-vite template) |
| `LICENSE`, `NOTICE` | Apache-2.0 + attribution to upstream Etherpad |

### 4.6 Tests (`tests/`)

| Path | Coverage |
|---|---|
| `tests/main/*.spec.ts` | Stores, IPC handlers, tab manager (with stubbed `WebContentsView`) |
| `tests/renderer/*.spec.tsx` | Components with React Testing Library |
| `tests/e2e/*.spec.ts` | Playwright-driven Electron, talks to a real Etherpad on `localhost:9003` |

## 5. Data model & persistence

Storage lives under `app.getPath('userData')` — on Linux `~/.config/etherpad-desktop/`. All persistent state goes through main-process stores; the renderer never touches disk.

```
~/.config/etherpad-desktop/
  workspaces.json         # WorkspacesFile
  pad-history.json        # PadHistoryFile
  settings.json           # Settings
  window-state.json       # WindowState
  pad-cache/              # Reserved for Spec 6 (offline). Empty in v1.
  Partitions/
    persist:ws-<uuid>/    # Electron-managed; cookies + localStorage + IndexedDB
  logs/
    main.log              # rotated 5 MB × 5
```

### 5.1 Schemas

```ts
// shared/types/workspace.ts
type Workspace = {
  id: string;            // uuid v4
  name: string;          // user-visible label
  serverUrl: string;     // normalised, no trailing slash
  color: string;         // hex, rail icon background
  createdAt: number;     // unix ms
};
type WorkspacesFile = {
  schemaVersion: 1;
  workspaces: Workspace[];
  order: string[];       // ids, display order in rail
};

// shared/types/pad-history.ts
type PadHistoryEntry = {
  workspaceId: string;
  padName: string;       // raw, as accepted by Etherpad
  lastOpenedAt: number;
  pinned: boolean;
  title?: string;        // optional friendly label, user-set
};
type PadHistoryFile = {
  schemaVersion: 1;
  entries: PadHistoryEntry[]; // capped per-workspace at 200 unpinned (FIFO eviction)
};

// shared/types/settings.ts
type Settings = {
  schemaVersion: 1;
  defaultZoom: number;            // 1.0
  accentColor: string;            // hex
  language: string;               // BCP-47; defaults to OS
  rememberOpenTabsOnQuit: boolean; // default true
};

// shared/types/window-state.ts
type WindowState = {
  schemaVersion: 1;
  windows: Array<{
    activeWorkspaceId: string | null;
    bounds: { x: number; y: number; width: number; height: number };
    openTabs: Array<{ workspaceId: string; padName: string }>;
    activeTabIndex: number;
  }>;
};
```

### 5.2 Reading & writing

- `electron-store` wraps each file. Atomic writes (write-tmp + rename) so a crash mid-write never corrupts.
- **Every read passes through Zod validation.** On corrupt or schema-mismatched data: rename to `<file>.broken-<ts>.json`, log a warning, return defaults. The user gets a working app instead of a hard error.
- All access is via main-process stores; renderer reads/writes through IPC. This avoids cross-window concurrency entirely.

### 5.3 Migration policy

`schemaVersion` is on every persisted file. On load:

- Equal version → use as-is.
- Older version → run forward migrations (`migrations/v<n>-to-v<n+1>.ts`), then save.
- Newer version (older binary opening newer data) → app refuses to start with a clear "please update" message rather than silently dropping fields.

For v1 there are no migrations; this is forward scaffolding.

### 5.4 What's *not* stored in v1

- Pad content. (Reserved for Spec 6.)
- Pad scroll positions or local edits.
- Webview cache (Electron-managed inside the partition dir).

### 5.5 Privacy

Pad names can themselves be sensitive (e.g. `therapy-notes-2026`). Therefore:

- Pad history is never included in any diagnostic or log output.
- Settings → **Clear Recent** (per workspace) and **Clear All History** (across workspaces).
- Removing a workspace wipes its workspace entry, its `persist:ws-${id}` partition (cookies + localStorage + IndexedDB + cache + service workers), and its pad-history entries — atomically (single IPC call, all-or-nothing in main).

## 6. Offline editing — future-proofing (zero-cost prep)

Etherpad is server-authoritative. Real offline editing — close laptop, edit for an hour, reconcile on reconnect — is its own future spec (Spec 6). For v1 we don't build it, but we don't paint ourselves into a corner.

What v1 includes specifically to keep Spec 6 cheap:

1. **`pad-cache/` directory reserved** in the on-disk layout (empty in v1). This is where per-pad snapshots and pending-changeset queues will live.
2. **`PadSyncService` placeholder** in main — see §3.5. v1 is a pass-through; Spec 6 puts cache/replay logic here.
3. **All `WebContentsView` creation goes through `pad-view-factory.ts`** — the single seam where a future `webRequest` interceptor or custom-protocol handler can be installed.
4. **`etherpad-app://` scheme registered** at boot (no handlers in v1).
5. **Pad-tab state machine designed to extend.** v1 enum: `loading | loaded | error | crashed`. Spec 6 adds `offline-cached | offline-pending | syncing | conflict`. UI components key off the enum.
6. **Schema-versioned `PadHistoryEntry`.** Spec 6 migrates to v2 with `cachedRevision`, `pendingChangesetCount`, `lastSyncedAt`. The migration framework already exists (§5.3).
7. **Section 5.4 phrasing matters:** v1 doesn't store pad text; the architecture *allows* it later.

Explicit v1 non-goals around offline:

- No local pad cache (read or write).
- No offline indicator in the UI.
- No "you can edit while offline" — if the server is unreachable, the pad shows Etherpad's existing disconnect UI.
- No background sync.

## 7. Key flows

### 7.1 First launch (cold start, empty state)

1. Main boot: acquire single-instance lock → init stores (return defaults) → register `etherpad-app://` scheme → build native menu.
2. Create one `BaseWindow`, load shell renderer.
3. Renderer reads state via `ipc.getInitialState()` → zero workspaces.
4. Renderer shows `AddWorkspaceDialog` as a non-dismissable modal (can quit, can't dismiss).
5. User submits `{ name, serverUrl, color }` → `ipc.workspace.add(...)`.
6. Main: normalise URL (strip trailing slash) → fetch `${serverUrl}/api/` to confirm Etherpad (looks for the API version manifest) → on success, persist + return new workspace; on failure, return typed error.
7. Renderer dismisses dialog, selects new workspace, empty sidebar, no tabs, "Open Pad…" prompt visible.

### 7.2 Add an additional workspace

Same as steps 4–7 above, triggered from rail "+" button.

### 7.3 Open a pad

Triggered by: `Ctrl+T` / "Open Pad…" → `OpenPadDialog`, OR sidebar click.

`ipc.tab.open({ workspaceId, padName, mode: 'open' | 'create' })`:

1. If a tab for `(workspaceId, padName)` already exists in this window, focus it; done.
2. `PadSyncService.resolveSrc(...)` returns the URL (v1: `${serverUrl}/p/${encodeURIComponent(padName)}`).
3. `pad-view-factory` creates a `WebContentsView` with `partition: persist:ws-${workspaceId}`. Add to this window's `TabManager`. Position over main area.
4. Subscribe to view events: `did-finish-load` → `loaded`; `did-fail-load` → `error`; `render-process-gone` → `crashed`; `page-title-updated` → update tab label.
5. Upsert `PadHistoryEntry` (`lastOpenedAt = now`).
6. Emit `tabs:changed` and `padHistory:changed` to the renderer.

`mode` is UI-only in v1: "create new" still navigates to `${serverUrl}/p/${padName}` — Etherpad creates the pad on first visit.

### 7.4 Switch workspace within a window

`ipc.window.setActiveWorkspace(workspaceId)`:

1. Hide all `WebContentsView`s belonging to the previous active workspace in this window (`setVisible(false)`; views stay alive).
2. For the newly active workspace: any of its tabs in this window that have not yet been materialised (cold-start case from §7.6) are created now. Then show all of its `WebContentsView`s and activate the previously-active tab for that workspace, if any.
3. Persist `windowState.activeWorkspaceId` for this window.
4. Tab strip and sidebar re-render against the new active workspace.

After this point, all of that workspace's open tabs in this window are materialised and stay alive across subsequent switches; only opening or closing a tab changes the materialised set.

### 7.5 Close tab / window / quit

- `Ctrl+W`: close active tab. If none left, main area shows the workspace's empty state. Window stays.
- Window close button: close window. If it's the last window, on Linux/Windows the app quits; on macOS the app keeps running.
- `Ctrl+Q` / `Cmd+Q`: quit app.
- On `before-quit`: if `settings.rememberOpenTabsOnQuit`, write each window's `{ activeWorkspaceId, bounds, openTabs[], activeTabIndex }` to `window-state.json`. Then close views, then quit.

### 7.6 Reopen app (warm start)

Main reads `window-state.json`:

- For each saved window: create `BaseWindow` with saved bounds → recreate `WebContentsView`s **eagerly** for the saved open tabs of the active workspace → activate the saved active tab. Tabs in *non-active* workspaces are listed but materialised lazily on first switch (§7.4 step 2).
- If `window-state.json` is missing, invalid, or has an empty `windows` array: open one window with bounds derived from screen size, set its active workspace to the first entry in `workspaces.order` (or `null` if none — which triggers the first-run flow from §7.1), no tabs.

### 7.7 Remove workspace

`ipc.workspace.remove(workspaceId)`. Order is deliberate — reversible store mutations first, irreversible partition wipe last:

1. Snapshot the in-memory state of `workspaces.json` and `pad-history.json` (kept for rollback).
2. In each window, close all tabs belonging to that workspace (destroy views).
3. `pad-history.json`: filter out entries for that workspace and persist.
4. `workspaces.json`: remove from list and order, persist.
5. `session.fromPartition('persist:ws-${id}').clearStorageData()` — wipes cookies, localStorage, IndexedDB, cache, service workers.
6. Emit `workspaces:changed` + `padHistory:changed`.

**Failure handling.** If step 3 or 4 fails (disk error), restore both stores from the snapshot taken in step 1, return a typed `StorageError` to the renderer, and surface a banner: "Couldn't remove workspace (disk error). [Retry]". Tabs were already closed (step 2) — they'll be re-opened on retry only if the user had `rememberOpenTabsOnQuit`-style restoration in the same session, which we don't do mid-flight, so they stay closed; the workspace remains intact otherwise. If step 5 fails (very rare), log a warning and queue a retry on next app boot (the partition is orphaned local storage but the workspace is already removed from the user's view).

## 8. Error handling

Principle: **never lose user state silently, never block boot for recoverable problems, never invent UX for errors that have an obvious native equivalent.**

### 8.1 Tab error states

Pad-view state machine drives all in-tab error UX.

| Trigger | New state | UI |
|---|---|---|
| `did-fail-load` (DNS, TLS, network, refused) | `error` | Shell renderer hides the `WebContentsView` and overlays an error panel: "Couldn't reach `<serverUrl>`. [Retry] [Close tab]". Tab strip marks the tab with an error indicator. |
| `render-process-gone` | `crashed` | Same overlay pattern: "This pad's view crashed. [Reload] [Close tab]". Reload destroys + recreates the `WebContentsView`. |
| HTTP 4xx / 5xx page rendered by server | (stays `loaded`) | We don't intercept — Etherpad's own UI does its job. |
| Slow load (>10 s without `did-finish-load`) | (still `loading`) | Tab strip shows a subtle "Still loading…" indicator. No automatic abort. |

Error panels are shell-renderer UI. We never inject HTML into the pad webview.

**TLS policy (v1):** strict. Self-signed certs fail with a clear message. Trust UX is phase-2.

### 8.2 HTTP authentication (proxy-level basic auth)

Electron's `app.on('login', ...)` fires for HTTP basic auth:

- Renderer-side dialog: "`<serverUrl>` requires authentication."
- Credentials go to Electron's callback; not stored by us. Server-set cookies persist in the workspace's partition.
- Cancel → tab transitions to `error`.

### 8.3 Storage errors

| Class | v1 behaviour |
|---|---|
| Corrupt JSON on read | Rename to `<file>.broken-<ts>.json`, return defaults, log warn. |
| Write failure (disk full, permission) | Retry once after 100 ms. If it still fails, IPC handler returns typed `StorageError` — calling renderer dialog/banner shows "Couldn't save (disk error). [Retry]" and stays open with the user's input intact. **No silent loss.** |
| `userData` not writable at boot | System dialog ("Etherpad Desktop can't write to `<path>`. Check permissions.") and exit cleanly. |

### 8.4 IPC payload validation

Every channel's payload is Zod-validated in main before reaching a handler. Invalid payload → handler returns `InvalidPayloadError`; renderer shows a generic "Something went wrong" toast; the actual error logs with the channel name. Renderer responses are also Zod-validated on the renderer side, defensively.

### 8.5 Renderer crash recovery

| Process | If it crashes |
|---|---|
| Shell renderer | Main detects via `render-process-gone`, reloads the shell. State survives in main, so the user lands back on same workspace + tabs after a flash. After 3 crashes within 60 s, main stops auto-reloading and shows a system dialog with "Quit". |
| Pad `WebContentsView` | Per-tab `crashed` state, see §8.1. |
| Main process | Process exit. Next launch reads `window-state.json` and restores. No checkpoint-on-action. |

### 8.6 Boot-time errors

| Trigger | Behaviour |
|---|---|
| Second instance | First instance gets `second-instance` event; in v1 it focuses its first window. (Phase 2 will forward args.) New instance exits 0. |
| Missing or unreadable build assets | System dialog with reinstall hint, exit. |

### 8.7 Top-level error boundary

A React `ErrorBoundary` at `App.tsx`:

- Catches render-time exceptions.
- Shows: "Something went wrong. [Reload window]" plus a "Show details" toggle (sanitised stack trace; no pad names).
- "Reload window" calls `ipc.window.reloadShell()` → main reloads the shell renderer. State survives in main.

### 8.8 Logging

- `electron-log` writing to `logs/main.log`, rotated at 5 MB × 5 files.
- Levels: `error` and `warn` always; `info` in dev only; `debug` behind `ELECTRON_DEBUG=1`.
- **Never logged:** pad content, pad names, workspace server URLs (workspace IDs are fine — opaque UUIDs).
- Help menu → "Open log folder" exposes the directory for support.

### 8.9 Explicitly *not* in v1 error handling

- Phone-home crash reporting. (Out of scope per §2.)
- Self-signed-cert trust UX (phase 2).
- "Recover unsent edits" UX (Spec 6).
- Network-status-driven reconnect banners. Etherpad's own UI shows websocket state.

## 9. Testing strategy

| Layer | Tool | Coverage |
|---|---|---|
| Unit (main) | Vitest | Stores, pure handlers, Zod schemas, URL normalisation, partition-name derivation, tab-state machine |
| Unit (renderer) | Vitest + React Testing Library | Components in isolation: rail, sidebar, tab strip, dialogs, error boundary |
| Integration / E2E | Playwright Test + `_electron.launch()` | Boot real app, drive shell UI, assert workspace flows, partition isolation, tab open/close/restore |
| Pad-loading E2E | Playwright + real Etherpad on `localhost:9003` | Test fixture spins up Etherpad with seeded pads; tests open them via the desktop app and assert load + history-update |
| Manual smoke | Checklist in `docs/smoke-test.md` | Native menu, DE-specific window decoration, reboot persistence — anything CI can't reasonably automate |

- **Test port:** `9003` for any spawned Etherpad.
- **CI execution on Linux:** xvfb. Mac/Win E2E land in their own platform specs.
- **Pre-merge gate:** lint + type check + unit + E2E. Pad-loading E2E runs as a separate job, required, allowed to be flaky in v1 (will be hardened during implementation).

## 10. Linux packaging & release

### 10.1 Distributables (v1)

| Format | Role | Notes |
|---|---|---|
| **AppImage** | Primary distributable | Single file from GitHub Releases. Self-contained. After download requires `chmod +x` (handled automatically by AppImageLauncher / GNOME Files dialog). |
| **`.deb`** | Secondary | For users who want a proper install. Drops `.desktop` file + icon, integrates with system menus. Same `electron-builder` config. |

### 10.2 Out of scope for v1 (Spec 2 covers)

- Snap (`snap-publish.yml` infrastructure from PR #7558 will be reused).
- Flatpak / Flathub.
- PPAs, distro repos, store submissions.

### 10.3 Auto-update metadata

`latest-linux.yml` is generated and uploaded with each release **even though auto-update isn't wired in v1.** This costs nothing now and makes phase-2 auto-update integration trivial — point `electron-updater` at the existing release feed.

### 10.4 Release CI

- **PR CI:** `lint → typecheck → unit → e2e (xvfb)` on every PR; build (no upload) on `main`.
- **Release CI:** GitHub Actions on `v*` tag → `electron-builder` → upload `.AppImage`, `.deb`, `latest-linux.yml`, per-arch checksums to GH Releases.
- **Versioning:** semver. `v1.x` series for thin client. `v2+` when embedded server lands (Spec 5).

### 10.5 Code signing on Linux

Out of scope for v1. Linux v1 ships unsigned AppImage / deb. Win/macOS specs will introduce signing at the same time as those builds.

## 11. Repository & licensing

- **GitHub repo:** `ether/etherpad-desktop` — brand-new repo, not a fork of `etherpad-lite`. Different language balance, different release cadence, different CI surface.
- **Working directory:** `/home/jose/etherpad/etherpad-desktop/` — fresh `git init`, no relation to existing `etherpad-lite/` working copy.
- **Project name in code, packaging, docs:** `etherpad-desktop`. Never `etherpad-lite-desktop` or any variant.
- **License:** `LICENSE` is Apache-2.0 verbatim. `NOTICE` credits upstream Etherpad and any third-party licenses electron-builder bundles.
- **`AGENTS.md`** included from day one, describing the dev loop (run, test, package).

Repo skeleton:

```
etherpad-desktop/
├── .github/workflows/{ci.yml, release.yml}
├── build/
│   ├── icons/                       # 16…1024 + ico/icns later
│   └── electron-builder.yml
├── docs/
│   └── superpowers/specs/
│       └── 2026-05-03-etherpad-desktop-linux-mvp-design.md
├── src/
│   ├── main/         # lifecycle, menu, windows, tabs, workspaces, ipc
│   ├── renderer/     # shell UI (React)
│   ├── preload/      # contextBridge
│   └── shared/       # types, validation, ipc channels
├── tests/
│   ├── main/         # Vitest
│   ├── renderer/     # Vitest + RTL
│   └── e2e/          # Playwright + Electron
├── AGENTS.md
├── LICENSE           # Apache-2.0
├── NOTICE
├── README.md
├── package.json
├── tsconfig*.json
├── vite.{main,renderer}.config.ts
├── vitest.config.ts
└── playwright.config.ts
```

## 12. MVP acceptance criteria

A non-technical Ubuntu user can:

1. Download `Etherpad Desktop-<version>.AppImage` from the latest GitHub Release.
2. Make it executable (handled automatically by AppImageLauncher / GNOME Files dialog) **OR** install the `.deb` for a fully double-click flow.
3. Run it. App opens to the **Add your first workspace** dialog.
4. Enter their Etherpad URL + name → workspace appears in the rail.
5. `Ctrl+T` or sidebar → open a pad. Edit normally; collaboration with others on the same server works exactly as it does in their browser.
6. Close the app. Reopen it. Workspaces, tabs, history all restored.
7. Add a second workspace pointing at a different server → sessions stay isolated, history per-workspace.
8. Remove a workspace from settings → confirmation → all related state (cookies, history, partition) is wiped.
