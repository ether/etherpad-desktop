import { randomUUID } from 'node:crypto';
import type { PadView, PadViewFactory } from '../pads/pad-view-factory.js';
import type { OpenTab, TabState } from '@shared/types/tab';

export type ViewHost = {
  add(view: PadView): void;
  remove(view: PadView): void;
  mainArea(): { x: number; y: number; width: number; height: number };
};

export type TabManagerOptions = {
  viewHost: ViewHost;
  factory: PadViewFactory;
  preloadPath: string;
  onTabsChanged: (tabs: OpenTab[]) => void;
  onTabState: (change: { tabId: string; state: TabState; errorMessage?: string; title?: string }) => void;
  /**
   * Called when a pad WebContentsView intercepts a "fast-switch" key
   * combo (Alt/Ctrl/Cmd + 1..9) so the main process can forward it to
   * the shell renderer. Without this hook, those shortcuts only work
   * when the shell has focus — they're invisible to the renderer's
   * keydown listener once focus is inside a pad view.
   */
  onPadFastSwitch?: (key: string) => void;
  /**
   * Called when a pad WebContentsView fires `context-menu`. The host
   * decides what to render (we do this in main where we have access
   * to Electron's Menu API). Without a handler, right-click silently
   * does nothing.
   */
  onPadContextMenu?: (
    view: PadView,
    params: { x: number; y: number; linkURL: string; selectionText: string; isEditable: boolean },
  ) => void;
};

type Internal = {
  tab: OpenTab;
  view: PadView;
};

export type OpenInput = { workspaceId: string; padName: string; src: string };

export class TabManager {
  private readonly tabs: Internal[] = [];
  private activeWorkspaceId: string | null = null;
  private activeTabId: string | null = null;

  constructor(private readonly opts: TabManagerOptions) {}

  getActiveWorkspaceId(): string | null { return this.activeWorkspaceId; }

  getActiveTabId(): string | null { return this.activeTabId; }

  setActiveWorkspace(workspaceId: string | null): void {
    this.activeWorkspaceId = workspaceId;
    // Promote the existing activeTabId only if it lives in the new workspace.
    const currentActive = this.tabs.find((t) => t.tab.tabId === this.activeTabId);
    const sameWs = currentActive && currentActive.tab.workspaceId === workspaceId;
    if (!sameWs) {
      const first = this.tabs.find((t) => t.tab.workspaceId === workspaceId);
      this.activeTabId = first?.tab.tabId ?? null;
    }
    this.applyVisibility();
  }

  async open(input: OpenInput): Promise<OpenTab> {
    const existing = this.tabs.find(
      (t) => t.tab.workspaceId === input.workspaceId && t.tab.padName === input.padName,
    );
    if (existing) {
      if (input.workspaceId === this.activeWorkspaceId) {
        this.activeTabId = existing.tab.tabId;
      }
      this.applyVisibility();
      this.emitTabs();
      return existing.tab;
    }
    const view = await this.opts.factory.create({
      workspaceId: input.workspaceId,
      src: input.src,
      preloadPath: this.opts.preloadPath,
    });
    const tab: OpenTab = {
      tabId: randomUUID(),
      workspaceId: input.workspaceId,
      padName: input.padName,
      title: input.padName,
      state: 'loading',
    };
    this.tabs.push({ tab, view });
    this.opts.viewHost.add(view);
    if (input.workspaceId === this.activeWorkspaceId) {
      this.activeTabId = tab.tabId;
    }
    this.applyVisibility();
    this.wireViewEvents(tab.tabId, view);
    this.emitTabs();
    return tab;
  }

  close(tabId: string): void {
    const idx = this.tabs.findIndex((t) => t.tab.tabId === tabId);
    if (idx < 0) return;
    const [removed] = this.tabs.splice(idx, 1);
    if (!removed) return;
    this.opts.viewHost.remove(removed.view);
    if (this.activeTabId === tabId) {
      const next = this.tabs.find((t) => t.tab.workspaceId === this.activeWorkspaceId);
      this.activeTabId = next?.tab.tabId ?? null;
    }
    this.applyVisibility();
    this.emitTabs();
  }

  focus(tabId: string): void {
    const t = this.tabs.find((x) => x.tab.tabId === tabId);
    if (!t) return;
    this.activeTabId = tabId;
    this.applyVisibility();
    this.emitTabs();
  }

  layout(): void {
    if (!this.activeTabId) return;
    const active = this.tabs.find((t) => t.tab.tabId === this.activeTabId);
    if (!active) return;
    active.view.setBounds(this.opts.viewHost.mainArea());
  }

  listAll(): OpenTab[] {
    return this.tabs.map((t) => ({ ...t.tab }));
  }

  listForWorkspace(workspaceId: string): OpenTab[] {
    return this.tabs.filter((t) => t.tab.workspaceId === workspaceId).map((t) => ({ ...t.tab }));
  }

  viewFor(tabId: string): PadView | undefined {
    return this.tabs.find((t) => t.tab.tabId === tabId)?.view;
  }

  setState(tabId: string, state: TabState, extras: { errorMessage?: string; title?: string } = {}): void {
    const t = this.tabs.find((x) => x.tab.tabId === tabId);
    if (!t) return;
    t.tab.state = state;
    if (extras.errorMessage !== undefined) t.tab.errorMessage = extras.errorMessage;
    if (extras.title !== undefined) t.tab.title = extras.title;
    this.opts.onTabState({ tabId, state, ...extras });
    this.emitTabs();
  }

  setPadViewsHidden(hidden: boolean): void {
    if (hidden) {
      for (const t of this.tabs) t.view.setVisible(false);
    } else {
      this.applyVisibility();
    }
  }

  destroyAll(): void {
    for (const t of this.tabs) this.opts.viewHost.remove(t.view);
    this.tabs.length = 0;
    this.activeTabId = null;
    this.emitTabs();
  }

  private applyVisibility(): void {
    for (const t of this.tabs) {
      const visible = t.tab.tabId === this.activeTabId;
      t.view.setVisible(visible);
      if (visible) t.view.setBounds(this.opts.viewHost.mainArea());
    }
  }

  private wireViewEvents(tabId: string, view: PadView): void {
    // Fast-switch key forwarding: when focus is inside this pad view, our
    // shell-renderer keydown listener never sees Alt/Ctrl/Cmd+1..9. Hook
    // before-input-event to intercept those before Etherpad gets them and
    // forward to the shell. Native menu accelerators do this automatically
    // for things like Ctrl+K, but we don't want 9 hidden menu items.
    type BeforeInputEvent = { preventDefault: () => void };
    type Input = { type: string; key: string; alt: boolean; control: boolean; meta: boolean; shift: boolean };
    const onBeforeInput = (event: BeforeInputEvent, input: Input) => {
      if (input.type !== 'keyDown') return;
      if (input.shift) return;
      if (!/^[1-9]$/.test(input.key)) return;
      if (!(input.alt || input.control || input.meta)) return;
      event.preventDefault();
      this.opts.onPadFastSwitch?.(input.key);
    };
    view.webContents.on('before-input-event', onBeforeInput as unknown as (...args: unknown[]) => void);

    // Right-click → host-rendered context menu. Without this, sandboxed
    // Electron WebContentsViews show no menu by default.
    if (this.opts.onPadContextMenu) {
      const onContextMenu = (...args: unknown[]) => {
        const params = args[1] as {
          x: number;
          y: number;
          linkURL: string;
          selectionText: string;
          isEditable: boolean;
        };
        this.opts.onPadContextMenu?.(view, params);
      };
      view.webContents.on('context-menu', onContextMenu);
    }

    view.webContents.on('did-finish-load', () => this.setState(tabId, 'loaded'));
    view.webContents.on('did-fail-load', (...args: unknown[]) => {
      const [, , errorDescription] = args as [unknown, number, string];
      this.setState(tabId, 'error', { errorMessage: errorDescription || 'Failed to load' });
    });
    view.webContents.on('render-process-gone', () => this.setState(tabId, 'crashed'));
    view.webContents.on('page-title-updated', (...args: unknown[]) => {
      const [, title] = args as [unknown, string];
      this.setState(tabId, this.tabs.find((t) => t.tab.tabId === tabId)?.tab.state ?? 'loaded', {
        title,
      });
    });
  }

  private emitTabs(): void {
    this.opts.onTabsChanged(this.listAll());
  }
}
