import { partitionFor } from '../workspaces/session.js';

export type PadView = {
  webContents: {
    loadURL(url: string): Promise<void>;
    on(event: string, listener: (...args: unknown[]) => void): void;
    getUserAgent(): string;
    setUserAgent(ua: string): void;
    id: number;
  };
  setBounds(bounds: { x: number; y: number; width: number; height: number }): void;
  setVisible(visible: boolean): void;
};

export type WebContentsViewCtor = new (opts: {
  webPreferences: {
    partition: string;
    contextIsolation: boolean;
    nodeIntegration: boolean;
    sandbox: boolean;
    preload: string;
  };
}) => PadView;

export type PadViewFactoryDeps = {
  WebContentsView: WebContentsViewCtor;
};

export type CreatePadViewInput = {
  workspaceId: string;
  src: string;
  preloadPath: string;
};

/**
 * Remove Electron-specific tokens from a Chromium user-agent string so
 * Etherpad plugins that user-agent-sniff (notably ep_webrtc, which
 * silently disables WebRTC when it sees "Electron/" because it
 * conservatively whitelists only browsers it recognises) treat us as
 * vanilla Chrome.
 *
 * Strips:
 *   - " Electron/<version>"  (always)
 *   - " etherpad-desktop/<version>"  (the app's own token)
 *
 * Leaves the platform string and Chrome/Safari tokens untouched, so
 * Etherpad's server-side feature detection still works correctly.
 */
export function stripElectronTokens(ua: string): string {
  return ua
    .replace(/\s*Electron\/\S+/gi, '')
    .replace(/\s*etherpad-desktop\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export class PadViewFactory {
  constructor(private readonly deps: PadViewFactoryDeps) {}

  async create(input: CreatePadViewInput): Promise<PadView> {
    const view = new this.deps.WebContentsView({
      webPreferences: {
        partition: partitionFor(input.workspaceId),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: input.preloadPath,
      },
    });
    // Override the UA before the first load so HTTP requests AND the
    // navigator.userAgent JS-side report the cleaned string. Setting it
    // after loadURL would leave the initial request with the Electron
    // tokens visible and ep_webrtc would already have made its decision.
    try {
      const wc = view.webContents;
      if (typeof wc.getUserAgent === 'function' && typeof wc.setUserAgent === 'function') {
        const cleaned = stripElectronTokens(wc.getUserAgent());
        wc.setUserAgent(cleaned);
      }
    } catch {
      // Defensive — never block pad creation on UA cleanup.
    }
    if (input.src !== '') {
      await view.webContents.loadURL(input.src);
    }
    return view;
  }
}
