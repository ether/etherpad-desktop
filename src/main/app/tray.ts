import { Tray, Menu, nativeImage } from 'electron';

export type TrayController = {
  setEnabled(enabled: boolean): void;
  destroy(): void;
};

export function setupTray(opts: {
  iconPath: string;
  onShow: () => void;
  onQuit: () => void;
}): TrayController {
  let tray: Tray | null = null;

  const build = () => {
    const image = nativeImage.createFromPath(opts.iconPath);
    const t = new Tray(image);
    t.setToolTip('Etherpad Desktop');
    t.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Show Etherpad Desktop', click: () => opts.onShow() },
        { type: 'separator' },
        { label: 'Quit Etherpad Desktop', click: () => opts.onQuit() },
      ]),
    );
    t.on('click', () => opts.onShow());
    return t;
  };

  return {
    setEnabled(enabled: boolean) {
      if (enabled && !tray) {
        try {
          tray = build();
        } catch (e) {
          // Some Linux DEs lack a tray; fall back silently. The setting can be turned on
          // but has no effect in those environments.
          // eslint-disable-next-line no-console
          console.warn('Tray unavailable on this system:', (e as Error).message);
        }
      } else if (!enabled && tray) {
        tray.destroy();
        tray = null;
      }
    },
    destroy() {
      if (tray) {
        tray.destroy();
        tray = null;
      }
    },
  };
}
