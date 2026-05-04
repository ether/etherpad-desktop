import { wrapHandler } from './dispatcher.js';
import { settingsUpdatePayload } from '@shared/ipc/channels';
import { z } from 'zod';
import type { SettingsStore } from '../settings/settings-store.js';

export function settingsHandlers(deps: { settings: SettingsStore; emitSettingsChanged: () => void }) {
  return {
    get: wrapHandler('settings.get', z.object({}), async () => deps.settings.get()),
    update: wrapHandler('settings.update', settingsUpdatePayload, async (patch) => {
      const next = deps.settings.update(patch as never);
      deps.emitSettingsChanged();
      return next;
    }),
  };
}
