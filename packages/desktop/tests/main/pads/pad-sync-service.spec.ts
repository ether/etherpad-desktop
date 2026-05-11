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

  it('appends ?lang= when a language is provided', () => {
    const svc = new PadSyncService();
    expect(svc.resolveSrc({
      kind: 'remote',
      serverUrl: 'https://x',
      padName: 'foo',
      lang: 'es',
    })).toBe('https://x/p/foo?lang=es');
  });

  it('omits ?lang= when lang is empty string', () => {
    const svc = new PadSyncService();
    expect(svc.resolveSrc({
      kind: 'remote',
      serverUrl: 'https://x',
      padName: 'foo',
      lang: '',
    })).toBe('https://x/p/foo');
  });

  it('percent-encodes non-ASCII lang codes', () => {
    const svc = new PadSyncService();
    expect(svc.resolveSrc({
      kind: 'remote',
      serverUrl: 'https://x',
      padName: 'foo',
      lang: 'zh-hans',
    })).toBe('https://x/p/foo?lang=zh-hans');
  });

  it('appends ?userName= when a userName is provided', () => {
    const svc = new PadSyncService();
    expect(svc.resolveSrc({
      kind: 'remote',
      serverUrl: 'https://x',
      padName: 'foo',
      userName: 'Alice',
    })).toBe('https://x/p/foo?userName=Alice');
  });

  it('omits userName= when userName is empty string', () => {
    const svc = new PadSyncService();
    expect(svc.resolveSrc({
      kind: 'remote',
      serverUrl: 'https://x',
      padName: 'foo',
      userName: '',
    })).toBe('https://x/p/foo');
  });

  it('appends both lang and userName when both provided', () => {
    const svc = new PadSyncService();
    expect(svc.resolveSrc({
      kind: 'remote',
      serverUrl: 'https://x',
      padName: 'foo',
      lang: 'es',
      userName: 'Bob',
    })).toBe('https://x/p/foo?lang=es&userName=Bob');
  });

  it('percent-encodes spaces in userName', () => {
    const svc = new PadSyncService();
    expect(svc.resolveSrc({
      kind: 'remote',
      serverUrl: 'https://x',
      padName: 'foo',
      userName: 'Alice Smith',
    })).toBe('https://x/p/foo?userName=Alice+Smith');
  });
});
