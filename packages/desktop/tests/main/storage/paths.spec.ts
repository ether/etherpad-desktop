import { describe, it, expect } from 'vitest';
import { paths } from '../../../src/main/storage/paths';

describe('paths', () => {
  it('returns deterministic file names under a base dir', () => {
    const p = paths('/tmp/userData');
    expect(p.workspacesFile).toBe('/tmp/userData/workspaces.json');
    expect(p.padHistoryFile).toBe('/tmp/userData/pad-history.json');
    expect(p.settingsFile).toBe('/tmp/userData/settings.json');
    expect(p.windowStateFile).toBe('/tmp/userData/window-state.json');
    expect(p.padCacheDir).toBe('/tmp/userData/pad-cache');
    expect(p.logsDir).toBe('/tmp/userData/logs');
  });
});
