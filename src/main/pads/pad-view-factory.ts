import { partitionFor } from '../workspaces/session.js';

export type PadView = {
  webContents: {
    loadURL(url: string): Promise<void>;
    on(event: string, listener: (...args: unknown[]) => void): void;
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
    if (input.src !== '') {
      await view.webContents.loadURL(input.src);
    }
    return view;
  }
}
