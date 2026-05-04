import { BaseWindow, WebContentsView } from 'electron';
import { TabManager, type ViewHost } from '../tabs/tab-manager.js';
import { PadViewFactory } from '../pads/pad-view-factory.js';
import type { OpenTab } from '@shared/types/tab';

export const RAIL_WIDTH = 64;
export const SIDEBAR_WIDTH = 240;
export const TAB_STRIP_HEIGHT = 40;

export function computeMainAreaRect(content: { width: number; height: number }) {
  const x = RAIL_WIDTH + SIDEBAR_WIDTH;
  const y = TAB_STRIP_HEIGHT;
  const width = Math.max(0, content.width - x);
  const height = Math.max(0, content.height - y);
  return { x, y, width, height };
}

export type AppWindowOptions = {
  bounds: { x: number; y: number; width: number; height: number };
  preloadPath: string;
  rendererUrl: string | null;
  rendererFile: string;
  onTabsChanged: (tabs: OpenTab[]) => void;
  onTabState: (s: { tabId: string; state: string; errorMessage?: string; title?: string }) => void;
  onClosed?: () => void;
};

export class AppWindow {
  readonly window: BaseWindow;
  readonly shellView: WebContentsView;
  readonly tabManager: TabManager;
  private readonly factory: PadViewFactory;

  constructor(opts: AppWindowOptions) {
    this.window = new BaseWindow({
      x: opts.bounds.x,
      y: opts.bounds.y,
      width: opts.bounds.width,
      height: opts.bounds.height,
      title: 'Etherpad Desktop',
    });

    this.shellView = new WebContentsView({
      webPreferences: {
        preload: opts.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    this.window.contentView.addChildView(this.shellView);
    const cs = this.window.getContentSize();
    this.shellView.setBounds({ x: 0, y: 0, width: cs[0]!, height: cs[1]! });

    if (opts.rendererUrl) {
      void this.shellView.webContents.loadURL(opts.rendererUrl);
    } else {
      void this.shellView.webContents.loadFile(opts.rendererFile);
    }

    this.factory = new PadViewFactory({ WebContentsView: WebContentsView as never });

    const host: ViewHost = {
      add: (v) => this.window.contentView.addChildView(v as unknown as WebContentsView),
      remove: (v) => this.window.contentView.removeChildView(v as unknown as WebContentsView),
      mainArea: () => {
        const [w, h] = this.window.getContentSize();
        return computeMainAreaRect({ width: w!, height: h! });
      },
    };

    this.tabManager = new TabManager({
      viewHost: host,
      factory: this.factory,
      preloadPath: opts.preloadPath,
      onTabsChanged: opts.onTabsChanged,
      onTabState: opts.onTabState as (change: { tabId: string; state: string; errorMessage?: string; title?: string }) => void,
    });

    this.window.on('resize', () => {
      const [w, h] = this.window.getContentSize();
      this.shellView.setBounds({ x: 0, y: 0, width: w!, height: h! });
      this.tabManager.layout();
    });

    this.window.on('closed', () => {
      try { this.tabManager.destroyAll(); } catch { /* views already gone */ }
      opts.onClosed?.();
    });
  }

  bounds(): { x: number; y: number; width: number; height: number } {
    const b = this.window.getBounds();
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  }

  destroy(): void {
    this.tabManager.destroyAll();
    this.window.destroy();
  }

  openTab(input: { workspaceId: string; padName: string; src: string }) {
    return this.tabManager.open(input);
  }
}
