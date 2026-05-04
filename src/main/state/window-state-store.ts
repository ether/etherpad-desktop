import { VersionedStore } from '../storage/versioned-store.js';
import { windowStateSchema } from '@shared/validation/window-state';
import type { WindowState } from '@shared/types/window-state';

export class WindowStateStore {
  private readonly inner: VersionedStore<WindowState>;

  constructor(file: string) {
    this.inner = new VersionedStore<WindowState>({
      file,
      schema: windowStateSchema,
      defaults: () => ({ schemaVersion: 1, windows: [] }),
    });
  }

  read(): WindowState {
    return this.inner.read();
  }

  save(state: WindowState): void {
    this.inner.write(state);
  }
}
