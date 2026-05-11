# Mobile — agent orientation

Capacitor 8 wrapper around `@etherpad/shell` for Android + iOS. Vite-built single-page app served to a native WebView.

## Read first

- `docs/superpowers/specs/2026-05-11-etherpad-mobile-android-design.md` — design.
- `docs/superpowers/plans/2026-05-11-etherpad-mobile-phase3-capacitor-bootstrap.md` — this phase.
- `packages/shell/AGENTS.md` — shell conventions; mobile inherits them.

## Layout

- `src/main.tsx` — boots: `setPlatform(createCapacitorPlatform())` then mounts `<App />`.
- `src/platform/capacitor.ts` — concrete `Platform` impl (Phase 3 is a stub; Phase 4+ swaps in `@capacitor/preferences` / `@capacitor/filesystem` / `@capacitor/share` / `@capacitor/app` / `@capacitor/browser`).
- `capacitor.config.ts` — appId, appName, webDir, native platform tuning.
- `android/` — Capacitor-generated Android project (Gradle). Pinned in git. Update via `pnpm exec cap update` when bumping Capacitor majors.
- `tests/smoke.spec.ts` — Playwright Chromium loads the production bundle and asserts the shell mounts.

## Conventions

- Don't import `electron` or `window.etherpadDesktop`. Mobile reads only via `Platform` through shell.
- F-Droid is the canonical distribution. No Google Play Services. No telemetry. No crash reporters. Document any new dependency in `packages/mobile/README.md` before adding it.
- Native plugin code (Android Kotlin, iOS Swift) lives under `android/app/src/main/java/...` and `ios/App/App/...`. Pure JS plugin shims live in `src/platform/`.
- The Capacitor CLI mostly assumes npm. We use pnpm; this is usually fine, but if `cap sync` complains about missing peers, run `pnpm install` from repo root first.

## Future phases (not in Phase 3)

- Phase 4: real `Platform` reads/writes via Capacitor plugins.
- Phase 5: `PadIframeStack` + tab UX (mobile-specific pad rendering).
- Phase 6: `PadWebviewPermissionsPlugin` (native code) + deep links + system share.
- Phase 7: mobile responsiveness adjustments inside the shell (bottom drawer < 768px, scrollable tab bar).
- Phase 8: F-Droid metadata + reproducible-build pinning.
