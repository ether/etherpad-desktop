# Phase 6a — Deep links + system share + external browser

> Phase 6 in the spec bundles native permissions, deep links, share, and the X-Frame fallback into one PR. The native permissions plugin (Android Kotlin) can't be CI-verified without a real device, so this PR (6a) lands everything that is web-testable; the native permissions plugin lands separately as 6b once a device is available.

**Goal:** Mobile gains three system-integration affordances visible on any device:

1. **System share** — "Share pad URL" floating action in `PadIframeStack` calls `@capacitor/share`. Web fallback (`navigator.share`) makes the action exerciseable in the dev/preview browser too.
2. **Open in external browser** — adjacent action calls `@capacitor/browser`. Used as the user-driven X-Frame fallback (if an embed is blocked the user has an obvious escape hatch). Auto-detection of X-Frame DENY requires a native hook on the WebChromeClient and lands in 6b.
3. **Deep links** — `etherpad://` scheme and `https://*/p/...` URLs handed to the app by Android (or by clicking a link in another in-app browser) parse to `(serverOrigin, padId)`. If a workspace matches the origin, open the pad; otherwise pre-seed `AddWorkspaceDialog` with the server URL.

**Architecture:**
- All three concerns are *mobile-only* — they don't touch the shell's `Platform` interface. Share + browser plugins are imported directly inside the mobile-only `PadIframeStack` overlay. Deep links register their listener in `main.tsx` and dispatch through `useShellStore` + `platform.tab.open`.
- The shell's existing `parsePadUrl` (in `@etherpad/shell/url`) is the source of truth for URL → `{serverUrl, padName}` parsing — no mobile duplicate.
- AndroidManifest intent filters declare `etherpad://` (custom scheme) plus HTTPS app links with `android:autoVerify="true"` so users can configure asset-link verification when packaging.

---

## Task 1: Add `@capacitor/share` + `@capacitor/browser` deps

- [ ] **Step 1: Install**

```bash
pnpm --filter @etherpad/mobile add @capacitor/share@^8.0.0 @capacitor/browser@^8.0.0
```

- [ ] **Step 2: Commit**

---

## Task 2: Tab-actions overlay in `PadIframeStack`

- [ ] **Step 1:** Add an absolutely-positioned floating action group in the top-right of `PadIframeStack` that's only visible when there's an active tab in the current workspace. Two buttons:
  - **Share** (📤) — calls `Share.share({ url: padUrl })`. Web fallback uses `navigator.share` if available, else falls back to clipboard.
  - **External browser** (↗) — calls `Browser.open({ url: padUrl })`.

```tsx
// New file: packages/mobile/src/components/PadActionsOverlay.tsx
import { Share } from '@capacitor/share';
import { Browser } from '@capacitor/browser';

export function PadActionsOverlay({ url, title }: { url: string; title: string }): React.JSX.Element {
  return (
    <div className="pad-actions-overlay" /* top-right floating */>
      <button aria-label="Share pad" onClick={() => void Share.share({ url, title })}>📤</button>
      <button aria-label="Open in external browser" onClick={() => void Browser.open({ url })}>↗</button>
    </div>
  );
}
```

- [ ] **Step 2:** Wire into `PadIframeStack` — for the active tab (when not behind a dialog), render the overlay alongside.

- [ ] **Step 3:** Smoke test: assert both buttons visible after `tab.open`, hidden when a dialog is open or when no active tab.

---

## Task 3: Deep link handler

- [ ] **Step 1:** New file `packages/mobile/src/platform/deep-links.ts`:

```typescript
import { App } from '@capacitor/app';
import { parsePadUrl } from '@shared/url';
import { useShellStore, dialogActions } from '@etherpad/shell/state';
import * as tabStore from './tabs/tab-store.js';

export function installDeepLinkHandler(): () => void {
  let cleanup: (() => void) | undefined;
  void App.addListener('appUrlOpen', ({ url }) => {
    handleUrl(url);
  }).then((sub) => {
    cleanup = (): void => void sub.remove();
  });
  return () => cleanup?.();
}

export function handleUrl(url: string): void {
  // Accept etherpad://<host>/p/<pad> and https://<host>/p/<pad>
  const normalised = url.replace(/^etherpad:/, 'https:');
  const parsed = parsePadUrl(normalised);
  if (!parsed) return;
  const { serverUrl, padName } = parsed;
  const state = useShellStore.getState();
  const ws = state.workspaces.find(
    (w) => normaliseOrigin(w.serverUrl) === normaliseOrigin(serverUrl),
  );
  if (ws) {
    tabStore.open({ workspaceId: ws.id, padName });
    useShellStore.getState().setActiveWorkspaceId(ws.id);
  } else {
    dialogActions.openDialog('addWorkspace', { initialServerUrl: serverUrl, initialPadName: padName });
  }
}

function normaliseOrigin(u: string): string {
  try {
    return new URL(u).origin;
  } catch {
    return u;
  }
}
```

(Note: `dialogActions.openDialog` may not accept arbitrary payload — if so, drop the pre-seed args and just open the dialog. Pre-seeding is nice-to-have.)

- [ ] **Step 2:** Wire `installDeepLinkHandler()` into `main.tsx` after `setPlatform()`.

- [ ] **Step 3:** Vitest unit test (or Playwright via `__test_platform`-like hook) for `handleUrl`: feed `etherpad://acme/p/hello`, assert tab store mutates with the matching workspace.

---

## Task 4: AndroidManifest intent filters

- [ ] **Step 1:** Edit `packages/mobile/android/app/src/main/AndroidManifest.xml` and add intent filters inside the main `<activity>`:

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https" android:pathPattern="/p/.*" />
</intent-filter>

<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="etherpad" />
</intent-filter>
```

(HTTPS intent filter is intentionally broad — `data android:host="*"` would be more permissive than Android wants. F-Droid metadata can list specific hosts users have asked us to autoVerify; default ships without `android:host` so Android prompts the user.)

---

## Task 5: PR

- [ ] **Step 1:** Open Phase 6a PR. Note in body that 6b (native permissions plugin) is pending hardware validation.
