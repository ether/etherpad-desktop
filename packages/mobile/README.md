# @etherpad/mobile

Capacitor-based mobile shell for Etherpad (Android-first, iOS-ready).

The Vite-built React app wraps `@etherpad/shell` and is hosted inside a Capacitor WebView. The seam between shell and runtime is the `Platform` interface, implemented here by `createCapacitorPlatform()` in `src/platform/capacitor.ts`.

## Develop in a desktop browser

```bash
pnpm --filter @etherpad/mobile dev
```

Opens `http://localhost:5173/` with the shell mounted on the stub Platform. The empty-state `AddWorkspaceDialog` should appear on first paint.

## Build the static bundle

```bash
pnpm --filter @etherpad/mobile build
```

Output lands in `packages/mobile/dist/`. Capacitor copies that into the Android WebView at `cap sync` time.

## Android

Requires JDK 17 and the Android SDK (`platform-tools`, `build-tools`, `platforms;android-34`).

```bash
pnpm --filter @etherpad/mobile cap:sync       # vite build + cap sync
pnpm --filter @etherpad/mobile android:open   # open in Android Studio
pnpm --filter @etherpad/mobile android:run    # build + sync + run on attached device/emulator
```

## What works in this state

- Shell boots inside the WebView (or browser) via `createCapacitorPlatform()` (stub).
- Empty state renders the non-dismissable `AddWorkspaceDialog`.
- All write IPC reject with `[mobile/Phase 3] <op> not implemented yet` — by design, Phase 4 wires real persistence.
