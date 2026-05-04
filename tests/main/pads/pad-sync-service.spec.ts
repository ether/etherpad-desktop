import { describe, it, expect } from 'vitest';
import { PadSyncService } from '../../../src/main/pads/pad-sync-service';

describe('PadSyncService.resolveSrc', () => {
  it('returns ${serverUrl}/p/${encoded(padName)} for a thin-client workspace', () => {
    const svc = new PadSyncService();
    const url = svc.resolveSrc({
      kind: 'remote',
      serverUrl: 'https://pads.example.com',
      padName: 'standup',
    });
    expect(url).toBe('https://pads.example.com/p/standup');
  });

  it('encodes special characters in pad name', () => {
    const svc = new PadSyncService();
    const url = svc.resolveSrc({
      kind: 'remote',
      serverUrl: 'https://x',
      padName: 'a b/c',
    });
    expect(url).toBe('https://x/p/a%20b%2Fc');
  });

  it('preserves a path prefix on the serverUrl', () => {
    const svc = new PadSyncService();
    const url = svc.resolveSrc({
      kind: 'remote',
      serverUrl: 'https://x/etherpad',
      padName: 'foo',
    });
    expect(url).toBe('https://x/etherpad/p/foo');
  });
});
