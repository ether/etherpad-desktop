# Phase 4 — Mobile storage + state Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `CapacitorPlatform`'s stub reads + rejecting writes with real persistence via `@capacitor/preferences`. After this PR, the workspace/padHistory/settings model survives across reloads (and across app launches once on a real device). The shell renders persisted workspaces on hydrate; adding/removing workspaces and changing settings round-trips correctly.

**Architecture:** Three small per-concern stores (`workspace-store`, `pad-history-store`, `settings-store`) wrap `@capacitor/preferences` reads/writes with Zod validation. Schemas reuse the existing definitions from `@etherpad/shell/validation/*` — no schema duplication. Each persisted blob carries `schemaVersion: 1`. The Capacitor Preferences web fallback stores values in `localStorage` under the `CapacitorStorage.<key>` prefix, so the same code runs in `vite dev` / `preview` and inside the Android WebView.

**Tech Stack:** `@capacitor/preferences` 8.x, Zod (via shell), TypeScript strict.

---

## Decisions locked in

1. **Reuse shell's Zod schemas verbatim.** No mobile-specific validators.
2. **One Preferences key per concern**: `etherpad:workspaces` (workspaces+order), `etherpad:settings`, `etherpad:padHistory:<workspaceId>`. Per-workspace pad history keys keep large blobs out of the workspace doc.
3. **No `@capacitor/filesystem` in this phase.** Pad history is currently small (per-workspace lists, not pad bodies); Preferences with 6MB+ headroom is fine. Filesystem comes when pad content indexing lands in Phase 5+.
4. **Tab/window/httpLogin/updater/quickSwitcher stay stubbed.** Phase 5 wires pad rendering; tab state is meaningless until then. httpLogin is desktop-only. Updater is desktop-only. quickSwitcher needs pad content indexing (later phase).
5. **Smoke test path:** pre-seed `localStorage` via `page.addInitScript`, reload, assert workspace renders in the rail. This tests the *read* path end-to-end (the more risky path — it has to thread persisted JSON through Zod into the shell store). Write path is tested by writing-then-reading in the same test.

---

## File structure after this plan

```
packages/mobile/src/platform/
├── capacitor.ts                   # createCapacitorPlatform() — refactored to use stores
└── storage/
    ├── preferences.ts             # tiny wrapper over @capacitor/preferences w/ Zod validation
    ├── workspace-store.ts         # load/save {workspaces, order}
    ├── pad-history-store.ts       # per-workspace pad history
    └── settings-store.ts          # load/save Settings
```

---

## Task 1: Add `@capacitor/preferences` dependency

- [ ] **Step 1: Add dep**

```bash
pnpm --filter @etherpad/mobile add @capacitor/preferences@^8.0.0
pnpm install
```

- [ ] **Step 2: Update `packages/mobile/capacitor.config.ts` if needed**

`@capacitor/preferences` requires no native install on Android (it's first-party). `cap sync` will register it automatically once we commit and run.

```bash
pnpm --filter @etherpad/mobile exec cap sync android 2>&1 | tail -10
```

(In CI we don't run cap sync; in local dev we do.)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(mobile): add @capacitor/preferences dependency"
git push -u origin feat/mobile-phase4-storage
```

---

## Task 2: Build the Preferences wrapper

- [ ] **Step 1: Create `packages/mobile/src/platform/storage/preferences.ts`**

```typescript
import { Preferences } from '@capacitor/preferences';
import type { ZodTypeAny, infer as zInfer } from 'zod';

/**
 * Read a Preferences key and parse it with the given Zod schema. Returns
 * `null` when the key is absent or the stored JSON doesn't match the
 * schema (caller's responsibility to fall back to a default in that case).
 *
 * The "couldn't parse" branch is treated as "no value" rather than thrown
 * because Phase 4 is single-runtime — if data on disk doesn't validate,
 * we'd rather reset to default than crash the app on boot.
 */
export async function loadJson<S extends ZodTypeAny>(
  key: string,
  schema: S,
): Promise<zInfer<S> | null> {
  const { value } = await Preferences.get({ key });
  if (value === null) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    const result = schema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export async function saveJson<S extends ZodTypeAny>(
  key: string,
  schema: S,
  value: zInfer<S>,
): Promise<void> {
  // Validate before persisting so we never write a malformed blob.
  schema.parse(value);
  await Preferences.set({ key, value: JSON.stringify(value) });
}

export async function removeKey(key: string): Promise<void> {
  await Preferences.remove({ key });
}

export async function listKeys(): Promise<string[]> {
  const { keys } = await Preferences.keys();
  return keys;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/mobile/src/platform/storage/preferences.ts
git commit -m "feat(mobile): add Preferences wrapper with Zod validation"
git push
```

---

## Task 3: Workspace store

- [ ] **Step 1: Create `packages/mobile/src/platform/storage/workspace-store.ts`**

```typescript
import type { Workspace } from '@etherpad/shell/state';   // adjust if export path differs
import { workspacesFileSchema } from '@shared/validation/workspace';
import { loadJson, saveJson } from './preferences.js';

const KEY = 'etherpad:workspaces';

export interface WorkspacesFile {
  schemaVersion: 1;
  workspaces: Workspace[];
  order: string[];
}

async function load(): Promise<WorkspacesFile> {
  const file = await loadJson(KEY, workspacesFileSchema);
  return file ?? { schemaVersion: 1, workspaces: [], order: [] };
}

async function save(file: WorkspacesFile): Promise<void> {
  await saveJson(KEY, workspacesFileSchema, file);
}

export async function list(): Promise<{ workspaces: Workspace[]; order: string[] }> {
  const file = await load();
  return { workspaces: file.workspaces, order: file.order };
}

export async function add(
  input: { name: string; serverUrl?: string; color: string; kind?: 'remote' | 'embedded' },
): Promise<Workspace> {
  const file = await load();
  const ws: Workspace = {
    id: crypto.randomUUID(),
    name: input.name,
    serverUrl: input.serverUrl ?? '',
    color: input.color,
    createdAt: Date.now(),
    ...(input.kind ? { kind: input.kind } : {}),
  };
  file.workspaces.push(ws);
  file.order.push(ws.id);
  await save(file);
  return ws;
}

export async function update(
  input: { id: string; name?: string; serverUrl?: string; color?: string },
): Promise<Workspace> {
  const file = await load();
  const ws = file.workspaces.find((w) => w.id === input.id);
  if (!ws) throw new Error(`Workspace ${input.id} not found`);
  if (input.name !== undefined) ws.name = input.name;
  if (input.serverUrl !== undefined) ws.serverUrl = input.serverUrl;
  if (input.color !== undefined) ws.color = input.color;
  await save(file);
  return ws;
}

export async function remove(input: { id: string }): Promise<void> {
  const file = await load();
  file.workspaces = file.workspaces.filter((w) => w.id !== input.id);
  file.order = file.order.filter((id) => id !== input.id);
  await save(file);
}

export async function reorder(input: { order: string[] }): Promise<string[]> {
  const file = await load();
  // Validate every id exists.
  const known = new Set(file.workspaces.map((w) => w.id));
  for (const id of input.order) {
    if (!known.has(id)) throw new Error(`Unknown workspace ${id}`);
  }
  file.order = input.order;
  await save(file);
  return input.order;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/mobile/src/platform/storage/workspace-store.ts
git commit -m "feat(mobile): add workspace store backed by Preferences"
git push
```

---

## Task 4: Pad history store

- [ ] **Step 1: Create `packages/mobile/src/platform/storage/pad-history-store.ts`**

```typescript
import type { PadHistoryEntry } from '@shared/types/pad-history';
import { padHistoryFileSchema } from '@shared/validation/pad-history';
import { listKeys, loadJson, removeKey, saveJson } from './preferences.js';

const PREFIX = 'etherpad:padHistory:';
const keyFor = (workspaceId: string) => `${PREFIX}${workspaceId}`;

async function load(workspaceId: string): Promise<PadHistoryEntry[]> {
  const file = await loadJson(keyFor(workspaceId), padHistoryFileSchema);
  return file?.entries ?? [];
}

async function save(workspaceId: string, entries: PadHistoryEntry[]): Promise<void> {
  await saveJson(keyFor(workspaceId), padHistoryFileSchema, { schemaVersion: 1, entries });
}

export async function list(input: { workspaceId: string }): Promise<PadHistoryEntry[]> {
  return load(input.workspaceId);
}

export async function pin(input: { workspaceId: string; padName: string }): Promise<void> {
  const entries = await load(input.workspaceId);
  const e = entries.find((x) => x.padName === input.padName);
  if (e) e.pinned = true;
  await save(input.workspaceId, entries);
}

export async function unpin(input: { workspaceId: string; padName: string }): Promise<void> {
  const entries = await load(input.workspaceId);
  const e = entries.find((x) => x.padName === input.padName);
  if (e) e.pinned = false;
  await save(input.workspaceId, entries);
}

export async function clearRecent(input: { workspaceId: string }): Promise<void> {
  const entries = (await load(input.workspaceId)).filter((e) => e.pinned);
  await save(input.workspaceId, entries);
}

export async function clearAll(): Promise<void> {
  const keys = await listKeys();
  for (const key of keys) {
    if (key.startsWith(PREFIX)) await removeKey(key);
  }
}

/** Used by `state.getInitial()` to bundle history for every known workspace. */
export async function loadAll(workspaceIds: string[]): Promise<Record<string, PadHistoryEntry[]>> {
  const result: Record<string, PadHistoryEntry[]> = {};
  for (const id of workspaceIds) result[id] = await load(id);
  return result;
}
```

- [ ] **Step 2: Commit**

---

## Task 5: Settings store

- [ ] **Step 1: Create `packages/mobile/src/platform/storage/settings-store.ts`**

```typescript
import type { Settings } from '@shared/types/settings';
import { defaultSettings, settingsSchema } from '@shared/validation/settings';
import { loadJson, saveJson } from './preferences.js';

const KEY = 'etherpad:settings';

export async function get(): Promise<Settings> {
  const stored = await loadJson(KEY, settingsSchema);
  return stored ?? defaultSettings;
}

export async function update(patch: Partial<Settings>): Promise<Settings> {
  const current = await get();
  const next: Settings = { ...current, ...patch, schemaVersion: 1 };
  await saveJson(KEY, settingsSchema, next);
  return next;
}
```

- [ ] **Step 2: Commit**

---

## Task 6: Wire stores into `createCapacitorPlatform`

- [ ] **Step 1: Refactor `packages/mobile/src/platform/capacitor.ts`**

Replace the stub workspace / padHistory / settings / state methods with calls to the stores. Tab / window / httpLogin / updater / quickSwitcher remain stubbed per the decisions above. All return the IPC envelope shape (`{ ok: true, value }`) when going through `unwrap`.

```typescript
import type { Platform } from '@etherpad/shell';
import * as workspaceStore from './storage/workspace-store.js';
import * as padHistoryStore from './storage/pad-history-store.js';
import * as settingsStore from './storage/settings-store.js';

export function createCapacitorPlatform(): Platform {
  const ok = Promise.resolve({ ok: true });
  const okValue = <T>(value: T) => Promise.resolve({ ok: true, value });
  const wrap = async <T>(fn: () => Promise<T>) => {
    try {
      const value = await fn();
      return { ok: true, value };
    } catch (err) {
      return {
        ok: false,
        error: {
          kind: 'UnknownError',
          message: err instanceof Error ? err.message : String(err),
        },
      };
    }
  };
  const notImpl = (op: string) =>
    Promise.resolve({
      ok: false,
      error: { kind: 'NotImplementedError', message: `[mobile] ${op} not implemented yet` },
    });
  const noopUnsubscribe = (): (() => void) => () => {};

  return {
    state: {
      getInitial: async () => {
        const { workspaces, order } = await workspaceStore.list();
        const settings = await settingsStore.get();
        const padHistory = await padHistoryStore.loadAll(order);
        return {
          ok: true,
          value: {
            workspaces,
            workspaceOrder: order,
            settings,
            padHistory,
          },
        };
      },
    },
    workspace: {
      list: () => wrap(workspaceStore.list),
      add: (input) => wrap(() => workspaceStore.add(input)),
      update: (input) => wrap(() => workspaceStore.update(input)),
      remove: (input) => wrap(async () => { await workspaceStore.remove(input); return { ok: true } as const; }),
      reorder: (input) => wrap(() => workspaceStore.reorder(input)),
    },
    tab: {
      open: () => notImpl('tab.open'),
      close: () => notImpl('tab.close'),
      focus: () => notImpl('tab.focus'),
      reload: () => notImpl('tab.reload'),
      hardReload: () => notImpl('tab.hardReload'),
    },
    window: {
      setActiveWorkspace: () => ok,
      reloadShell: () => { window.location.reload(); return ok; },
      setPadViewsHidden: () => ok,
      setRailCollapsed: () => ok,
    },
    padHistory: {
      list: (input) => wrap(() => padHistoryStore.list(input)),
      pin: (input) => wrap(async () => { await padHistoryStore.pin(input); return { ok: true } as const; }),
      unpin: (input) => wrap(async () => { await padHistoryStore.unpin(input); return { ok: true } as const; }),
      clearRecent: (input) => wrap(async () => { await padHistoryStore.clearRecent(input); return { ok: true } as const; }),
      clearAll: () => wrap(async () => { await padHistoryStore.clearAll(); return { ok: true } as const; }),
    },
    settings: {
      get: () => wrap(settingsStore.get),
      update: (patch) => wrap(() => settingsStore.update(patch)),
    },
    httpLogin: { respond: () => notImpl('httpLogin.respond') },
    updater: {
      checkNow: () => notImpl('updater.checkNow'),
      installAndRestart: () => notImpl('updater.installAndRestart'),
      getState: () => Promise.resolve({ kind: 'unsupported', reason: 'mobile' }),
    },
    quickSwitcher: { searchPadContent: () => Promise.resolve([]) },
    events: {
      onWorkspacesChanged: noopUnsubscribe,
      onPadHistoryChanged: noopUnsubscribe,
      onTabsChanged: noopUnsubscribe,
      onTabState: noopUnsubscribe,
      onSettingsChanged: noopUnsubscribe,
      onHttpLoginRequest: noopUnsubscribe,
      onUpdaterState: noopUnsubscribe,
      onPadFastSwitch: noopUnsubscribe,
      onMenuShellMessage: noopUnsubscribe,
    },
  };
}
```

Note on imports: paths like `@shared/validation/workspace` need the mobile tsconfig's `paths` to resolve `@shared/*` to `../shell/src/*`. If that alias isn't set on mobile, use `@etherpad/shell/...` subpath exports OR fall back to relative paths (`../../../../shell/src/validation/workspace.js`). The cleanest fix is adding the `@shared` alias to mobile's tsconfig and Vite config — matches desktop's pattern.

- [ ] **Step 2: Add `@shared` alias to mobile's Vite + tsconfig**

- [ ] **Step 3: Typecheck + build + commit**

---

## Task 7: Persistence smoke test

- [ ] **Step 1: Extend `packages/mobile/tests/smoke.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test('mobile bundle boots: shell mounts and shows the first-launch AddWorkspaceDialog', async ({ page }) => {
  await page.goto('/');
  const heading = page.getByRole('heading', { name: /add an etherpad instance/i });
  await expect(heading).toBeVisible({ timeout: 15_000 });
});

test('persisted workspaces hydrate the rail and skip the empty-state dialog', async ({ page }) => {
  // Seed Capacitor Preferences (web fallback = localStorage with CapacitorStorage. prefix).
  await page.addInitScript(() => {
    const wsFile = {
      schemaVersion: 1,
      workspaces: [
        { id: '00000000-0000-4000-8000-000000000001', name: 'Acme', serverUrl: 'https://acme.example/', color: '#3366cc', createdAt: 1 },
      ],
      order: ['00000000-0000-4000-8000-000000000001'],
    };
    localStorage.setItem('CapacitorStorage.etherpad:workspaces', JSON.stringify(wsFile));
  });
  await page.goto('/');

  // Rail shows the workspace; AddWorkspaceDialog is NOT visible.
  await expect(page.getByRole('button', { name: /open instance acme/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /add an etherpad instance/i })).not.toBeVisible();
});
```

- [ ] **Step 2: Run locally**

```bash
pnpm --filter @etherpad/mobile test
```

Both tests should pass.

- [ ] **Step 3: Commit**

---

## Task 8: Open PR + monitor CI + Qodo

Stacked off main (Phase 3 just merged).
