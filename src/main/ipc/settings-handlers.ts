import { wrapHandler } from './dispatcher.js';
import { settingsUpdatePayload } from '@shared/ipc/channels';
import { z } from 'zod';
import type { SettingsStore } from '../settings/settings-store.js';

export function settingsHandlers(deps: {
  settings: SettingsStore;
  emitSettingsChanged: () => void;
  reloadAllPadsWithLanguage: (lang: string) => void;
  onMinimizeToTrayChanged?: (enabled: boolean) => void;
}) {
  return {
    get: wrapHandler('settings.get', z.object({}), async () => deps.settings.get()),
    update: wrapHandler('settings.update', settingsUpdatePayload, async (patch) => {
      const prev = deps.settings.get();
      const next = deps.settings.update(patch as never);
      deps.emitSettingsChanged();
      if (patch.language && patch.language !== prev.language) {
        deps.reloadAllPadsWithLanguage(next.language);
      }
      if (patch.minimizeToTray !== undefined && patch.minimizeToTray !== prev.minimizeToTray) {
        deps.onMinimizeToTrayChanged?.(next.minimizeToTray);
      }
      return next;
    }),
  };
}
