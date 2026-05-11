import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SettingsStore } from '../../../src/main/settings/settings-store';
import { defaultSettings } from '@shared/validation/settings';

let dir: string;
let store: SettingsStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'epd-settings-'));
  store = new SettingsStore(join(dir, 'settings.json'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('SettingsStore', () => {
  it('returns defaults if file missing', () => {
    expect(store.get()).toEqual(defaultSettings);
  });

  it('updates a single field', () => {
    store.update({ defaultZoom: 1.5 });
    expect(store.get().defaultZoom).toBe(1.5);
    expect(store.get().accentColor).toBe(defaultSettings.accentColor);
  });

  it('persists across instances', () => {
    store.update({ language: 'fr' });
    const s2 = new SettingsStore(join(dir, 'settings.json'));
    expect(s2.get().language).toBe('fr');
  });

  it('rejects invalid update via schema', () => {
    expect(() => store.update({ defaultZoom: 99 })).toThrow();
  });
});
