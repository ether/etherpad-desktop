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

  setActiveWorkspace(workspaceId: string | null): void {
    this.activeWorkspaceId = workspaceId;
    for (const t of this.tabs) {
      const visible = t.tab.workspaceId === workspaceId;
      t.view.setVisible(visible);
      if (visible) t.view.setBounds(this.opts.viewHost.mainArea());
    }
  }

  async open(input: OpenInput): Promise<OpenTab> {
    const existing = this.tabs.find(
      (t) => t.tab.workspaceId === input.workspaceId && t.tab.padName === input.padName,
    );
    if (existing) {
      this.activeTabId = existing.tab.tabId;
      existing.view.setVisible(input.workspaceId === this.activeWorkspaceId);
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
      view.setBounds(this.opts.viewHost.mainArea());
      view.setVisible(true);
      this.activeTabId = tab.tabId;
    } else {
      view.setVisible(false);
    }
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
      if (next) {
        next.view.setBounds(this.opts.viewHost.mainArea());
        next.view.setVisible(true);
      }
    }
    this.emitTabs();
  }

  focus(tabId: string): void {
    const t = this.tabs.find((x) => x.tab.tabId === tabId);
    if (!t) return;
    this.activeTabId = tabId;
    t.view.setBounds(this.opts.viewHost.mainArea());
    t.view.setVisible(true);
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

  destroyAll(): void {
    for (const t of this.tabs) this.opts.viewHost.remove(t.view);
    this.tabs.length = 0;
    this.activeTabId = null;
    this.emitTabs();
  }

  private wireViewEvents(tabId: string, view: PadView): void {
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
