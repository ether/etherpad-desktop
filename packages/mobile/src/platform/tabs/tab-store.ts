import type { OpenTab } from '@shared/types/tab';
import * as padHistoryStore from '../storage/pad-history-store.js';
import * as tabPersistence from './tab-persistence.js';

/**
 * In-memory mobile tab state + a thin per-event subscriber list, persisted
 * to `@capacitor/preferences` under `etherpad:windowState` so closing the
 * app and reopening it restores the open pads + active tab.
 *
 * Events are intentionally synchronous: the shell subscribes once at mount
 * and expects `{ tabs, activeTabId }` payloads matching its own Zustand
 * `replaceTabs(...)` + `setActiveTabId(...)` API.
 *
 * Persistence is fire-and-forget — every mutation triggers a debounced
 * save so rapid taps don't thrash Preferences.
 */

type Listener<P> = (payload: P) => void;
type Unsubscribe = () => void;

class Emitter<Events extends Record<string, unknown>> {
  private listeners: { [K in keyof Events]?: Set<Listener<Events[K]>> } = {};
  on<K extends keyof Events>(key: K, l: Listener<Events[K]>): Unsubscribe {
    let set = this.listeners[key];
    if (!set) {
      set = new Set();
      this.listeners[key] = set;
    }
    set.add(l);
    return () => set.delete(l);
  }
  emit<K extends keyof Events>(key: K, payload: Events[K]): void {
    this.listeners[key]?.forEach((l) => l(payload));
  }
}

export interface TabsChangedPayload {
  tabs: OpenTab[];
  activeTabId: string | null;
}
export interface TabStatePayload {
  tabId: string;
  state: 'loading' | 'loaded' | 'error' | 'crashed';
  errorMessage?: string;
  title?: string;
}

type TabEvents = {
  tabsChanged: TabsChangedPayload;
  tabState: TabStatePayload;
};

const emitter = new Emitter<TabEvents>();
const tabs = new Map<string, OpenTab>();
let activeTabId: string | null = null;
let activeWorkspaceId: string | null = null;

function snapshot(): TabsChangedPayload {
  return { tabs: Array.from(tabs.values()), activeTabId };
}

function scheduleSave(): void {
  // Write-through immediately on every mutation. A debounce here would
  // lose writes when the user opens a pad and kills the app before the
  // timer fires — Android's `am force-stop` doesn't drain pending JS
  // microtasks. tab.open fires rarely (per user gesture), so writing
  // on every mutation is cheap.
  void tabPersistence
    .save({
      tabs: Array.from(tabs.values()).map((t) => ({
        tabId: t.tabId,
        workspaceId: t.workspaceId,
        padName: t.padName,
      })),
      activeTabId,
      activeWorkspaceId,
    })
    .catch((err: unknown) => {
      console.warn('[mobile/tab-store] windowState save failed:', err);
    });
}

function emitChanged(): void {
  emitter.emit('tabsChanged', snapshot());
  scheduleSave();
}

/**
 * Restore tabs from Preferences. Idempotent; called once at boot via
 * `state.getInitial()`. Fires `tabsChanged` so any subscribers already
 * mounted see the restored set.
 */
export async function loadFromStorage(): Promise<{ activeWorkspaceId: string | null }> {
  const persisted = await tabPersistence.load();
  tabs.clear();
  for (const t of persisted.tabs) {
    tabs.set(t.tabId, {
      tabId: t.tabId,
      workspaceId: t.workspaceId,
      padName: t.padName,
      title: t.padName,
      state: 'loading',
    });
  }
  activeTabId = persisted.activeTabId;
  activeWorkspaceId = persisted.activeWorkspaceId;
  // Don't scheduleSave here — we just loaded; saving would be a no-op
  // but emit so anyone already subscribed picks up the restored state.
  emitter.emit('tabsChanged', snapshot());
  return { activeWorkspaceId };
}

/** Called when the user (or App.tsx boot) sets a new active workspace. */
export function setActiveWorkspace(workspaceId: string | null): void {
  if (activeWorkspaceId === workspaceId) return;
  activeWorkspaceId = workspaceId;
  scheduleSave();
}

function makeTabId(workspaceId: string, padName: string): string {
  return `${workspaceId}::${padName}`;
}

export function listAll(): OpenTab[] {
  return Array.from(tabs.values());
}

export function getActiveTabId(): string | null {
  return activeTabId;
}

const openedEmitter = new Emitter<{ opened: { tabId: string } }>();
export function onOpened(l: (payload: { tabId: string }) => void): Unsubscribe {
  return openedEmitter.on('opened', l);
}

export function open(input: {
  workspaceId: string;
  padName: string;
  mode?: 'open' | 'create';
}): OpenTab {
  const tabId = makeTabId(input.workspaceId, input.padName);
  // Bump the workspace's pad-history. Fire-and-forget — but log failures
  // explicitly so we don't silently lose history (the upsert's Zod
  // validation throws on malformed schemas and we'd never know).
  padHistoryStore
    .upsert({ workspaceId: input.workspaceId, padName: input.padName })
    .catch((err: unknown) => {
      console.warn('[mobile/tab-store] padHistory.upsert failed:', err);
    });
  const existing = tabs.get(tabId);
  if (existing) {
    activeTabId = tabId;
    emitChanged();
    openedEmitter.emit('opened', { tabId });
    return existing;
  }
  const tab: OpenTab = {
    tabId,
    workspaceId: input.workspaceId,
    padName: input.padName,
    title: input.padName,
    state: 'loading',
  };
  tabs.set(tabId, tab);
  activeTabId = tabId;
  emitChanged();
  openedEmitter.emit('opened', { tabId });
  return tab;
}

export function close(tabId: string): void {
  if (!tabs.delete(tabId)) return;
  if (activeTabId === tabId) {
    const remaining = Array.from(tabs.keys());
    activeTabId = remaining[remaining.length - 1] ?? null;
  }
  emitChanged();
}

export function focus(tabId: string): void {
  if (!tabs.has(tabId)) return;
  activeTabId = tabId;
  emitChanged();
}

/** "Reload" on mobile is a hint to the iframe; PadIframeStack consumes
 *  this by bumping a per-tab reload key. We model that as an event the
 *  shell DOES NOT subscribe to but PadIframeStack does. */
const reloadEmitter = new Emitter<{ reload: { tabId: string } }>();
export function reload(tabId: string): void {
  if (!tabs.has(tabId)) return;
  reloadEmitter.emit('reload', { tabId });
}
export function onReload(l: (payload: { tabId: string }) => void): Unsubscribe {
  return reloadEmitter.on('reload', l);
}

/** "Hard reload" — currently same effect as reload on mobile (no service
 *  worker cache to bypass in v1). Distinct method so the shell's IPC
 *  contract stays consistent. */
export function hardReload(tabId: string): void {
  reload(tabId);
}

export function onTabsChanged(l: Listener<TabsChangedPayload>): Unsubscribe {
  // Fire once on subscribe so subscribers don't need a separate "initial"
  // read path — matches desktop's broadcast-after-subscribe semantics.
  queueMicrotask(() => l(snapshot()));
  return emitter.on('tabsChanged', l);
}

export function onTabState(l: Listener<TabStatePayload>): Unsubscribe {
  return emitter.on('tabState', l);
}

/** Called by PadIframeStack when an iframe fires its `load` event. */
export function markLoaded(tabId: string, title?: string): void {
  const tab = tabs.get(tabId);
  if (!tab) return;
  tab.state = 'loaded';
  if (title) tab.title = title;
  emitter.emit('tabState', {
    tabId,
    state: 'loaded',
    ...(title ? { title } : {}),
  });
}

/** Called by PadIframeStack when an iframe errors (incl. X-Frame DENY). */
export function markError(tabId: string, errorMessage: string): void {
  const tab = tabs.get(tabId);
  if (!tab) return;
  tab.state = 'error';
  tab.errorMessage = errorMessage;
  emitter.emit('tabState', { tabId, state: 'error', errorMessage });
}

/** Test-only: reset everything between Playwright tests. */
export function __resetForTests(): void {
  tabs.clear();
  activeTabId = null;
}
