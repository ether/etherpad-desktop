import { VersionedStore } from '../storage/versioned-store.js';
import { settingsSchema, defaultSettings } from '@shared/validation/settings';
import type { Settings } from '@shared/types/settings';

export type SettingsUpdate = Partial<Omit<Settings, 'schemaVersion'>>;

export class SettingsStore {
  private readonly inner: VersionedStore<Settings>;
  private state: Settings;

  constructor(file: string) {
    this.inner = new VersionedStore<Settings>({
      file,
      schema: settingsSchema,
      defaults: () => ({ ...defaultSettings }),
    });
    this.state = this.inner.read();
  }

  get(): Settings {
    return { ...this.state };
  }

  update(patch: SettingsUpdate): Settings {
    const next: Settings = { ...this.state, ...patch };
    settingsSchema.parse(next);
    this.state = next;
    this.inner.write(this.state);
    return this.get();
  }
}
