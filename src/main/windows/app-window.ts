import { BaseWindow, Menu, WebContentsView } from 'electron';
import { TabManager, type ViewHost } from '../tabs/tab-manager.js';
import { PadViewFactory } from '../pads/pad-view-factory.js';
import type { PadView } from '../pads/pad-view-factory.js';
import type { OpenTab } from '@shared/types/tab';

export const RAIL_WIDTH = 64;
export const SIDEBAR_WIDTH = 240;
export const TAB_STRIP_HEIGHT = 40;

/**
 * Width reserved on the left of the pad area when the rail+sidebar are
 * collapsed, so the DOM-rendered expand handle isn't painted over by the
 * native WebContentsView (which sits *above* the shell renderer in the
 * z-order). Without this gap, "focus mode" hides the only way back out.
 */
export const COLLAPSED_LEFT_GUTTER = 28;

/**
 * Compute the rectangle the pad WebContentsView should occupy.
 *
 * When `railCollapsed` is true the renderer's CSS hides both the rail and
 * the sidebar, so the pad fills the full window width minus the tab strip
 * — except for a thin gutter on the left that leaves room for the
 * expand-handle button. Without this the WebContentsView either covers
 * the handle (focus mode becomes a one-way trip) or, before this fix,
 * stayed at x=304 leaving a "black void" the width of the rail+sidebar.
 */
export function computeMainAreaRect(
  content: { width: number; height: number },
  opts: { railCollapsed?: boolean } = {},
) {
  const x = opts.railCollapsed ? COLLAPSED_LEFT_GUTTER : RAIL_WIDTH + SIDEBAR_WIDTH;
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
  /** When this returns true, the close button hides the window instead of closing it. */
  getMinimizeToTray?: () => boolean;
};

export class AppWindow {
  readonly window: BaseWindow;
  readonly shellView: WebContentsView;
  readonly tabManager: TabManager;
  private readonly factory: PadViewFactory;
  private railCollapsed = false;

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
        return computeMainAreaRect({ width: w!, height: h! }, { railCollapsed: this.railCollapsed });
      },
    };

    this.tabManager = new TabManager({
      viewHost: host,
      factory: this.factory,
      preloadPath: opts.preloadPath,
      onTabsChanged: opts.onTabsChanged,
      onTabState: opts.onTabState as (change: { tabId: string; state: string; errorMessage?: string; title?: string }) => void,
      // Forward Alt/Ctrl/Cmd+1..9 from a focused pad view up to the shell
      // renderer. Without this, those shortcuts only work when the shell
      // has focus.
      onPadFastSwitch: (key: string) => {
        this.shellView.webContents.send('shell.padFastSwitch', { key });
      },
      // Render a basic context menu when the user right-clicks inside a
      // pad view. Sandboxed Electron WebContentsViews show no menu by
      // default; we wire one explicitly with the entries Etherpad users
      // actually need (clipboard ops, Inspect Element in dev, Reload Pad).
      onPadContextMenu: (view: PadView, params) => {
        const wc = view.webContents as unknown as {
          copy: () => void;
          cut: () => void;
          paste: () => void;
          undo: () => void;
          redo: () => void;
          selectAll: () => void;
          reload: () => void;
          inspectElement: (x: number, y: number) => void;
          isDevToolsOpened: () => boolean;
        };
        const isDev = process.env.NODE_ENV !== 'production';
        const template: Electron.MenuItemConstructorOptions[] = [
          { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => wc.undo(), enabled: params.isEditable },
          { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', click: () => wc.redo(), enabled: params.isEditable },
          { type: 'separator' },
          { label: 'Cut', accelerator: 'CmdOrCtrl+X', click: () => wc.cut(), enabled: params.isEditable && params.selectionText.length > 0 },
          { label: 'Copy', accelerator: 'CmdOrCtrl+C', click: () => wc.copy(), enabled: params.selectionText.length > 0 },
          { label: 'Paste', accelerator: 'CmdOrCtrl+V', click: () => wc.paste(), enabled: params.isEditable },
          { label: 'Select All', accelerator: 'CmdOrCtrl+A', click: () => wc.selectAll() },
          { type: 'separator' },
          { label: 'Reload Pad', accelerator: 'CmdOrCtrl+R', click: () => wc.reload() },
        ];
        if (isDev) {
          template.push(
            { type: 'separator' },
            { label: 'Inspect Element', click: () => wc.inspectElement(params.x, params.y) },
          );
        }
        const menu = Menu.buildFromTemplate(template);
        menu.popup({ window: this.window as never });
      },
    });

    this.window.on('resize', () => {
      const [w, h] = this.window.getContentSize();
      this.shellView.setBounds({ x: 0, y: 0, width: w!, height: h! });
      this.tabManager.layout();
    });

    this.window.on('close', (e) => {
      if (opts.getMinimizeToTray?.()) {
        e.preventDefault();
        this.window.hide();
      }
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

  /**
   * Renderer reports rail-collapsed state via IPC; we re-layout the pad view
   * so it fills the freed rail+sidebar area instead of leaving a black void.
   */
  setRailCollapsed(collapsed: boolean): void {
    if (this.railCollapsed === collapsed) return;
    this.railCollapsed = collapsed;
    this.tabManager.layout();
  }
}
