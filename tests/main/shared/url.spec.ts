import { describe, it, expect } from 'vitest';
import { normalizeServerUrl, padUrl, parsePadUrl } from '@shared/url';

describe('normalizeServerUrl', () => {
  it('strips trailing slashes', () => {
    expect(normalizeServerUrl('https://pads.example.com/')).toBe('https://pads.example.com');
    expect(normalizeServerUrl('https://pads.example.com///')).toBe('https://pads.example.com');
  });

  it('preserves explicit path prefix without trailing slash', () => {
    expect(normalizeServerUrl('https://example.com/etherpad/')).toBe('https://example.com/etherpad');
  });

  it('rejects non-http(s) schemes', () => {
    expect(() => normalizeServerUrl('ftp://x')).toThrow(/http|https/);
    expect(() => normalizeServerUrl('javascript:alert(1)')).toThrow();
  });

  it('rejects malformed URLs', () => {
    expect(() => normalizeServerUrl('not a url')).toThrow();
    expect(() => normalizeServerUrl('')).toThrow();
  });
});

describe('padUrl', () => {
  it('builds /p/<encoded-name> against the server', () => {
    expect(padUrl('https://pads.example.com', 'standup')).toBe('https://pads.example.com/p/standup');
  });

  it('encodes special characters', () => {
    expect(padUrl('https://x', 'a b/c')).toBe('https://x/p/a%20b%2Fc');
  });

  it('preserves path prefix on server URL', () => {
    expect(padUrl('https://x/etherpad', 'foo')).toBe('https://x/etherpad/p/foo');
  });
});

describe('parsePadUrl', () => {
  it('extracts (serverUrl, padName) from a basic pad URL', () => {
    expect(parsePadUrl('https://pad.example.com/p/standup')).toEqual({
      serverUrl: 'https://pad.example.com',
      padName: 'standup',
    });
  });

  it('strips query and hash', () => {
    expect(parsePadUrl('https://pad.example.com/p/standup?lang=es#x')).toEqual({
      serverUrl: 'https://pad.example.com',
      padName: 'standup',
    });
  });

  it('handles a path-prefixed Etherpad install', () => {
    expect(parsePadUrl('https://example.com/etherpad/p/foo')).toEqual({
      serverUrl: 'https://example.com/etherpad',
      padName: 'foo',
    });
  });

  it('decodes percent-encoded pad names', () => {
    expect(parsePadUrl('https://x/p/a%20b')).toEqual({
      serverUrl: 'https://x',
      padName: 'a b',
    });
  });

  it('tolerates a trailing slash after the pad name', () => {
    expect(parsePadUrl('https://x/p/standup/')).toEqual({
      serverUrl: 'https://x',
      padName: 'standup',
    });
  });

  it('preserves an explicit non-default port', () => {
    expect(parsePadUrl('http://localhost:9001/p/foo')).toEqual({
      serverUrl: 'http://localhost:9001',
      padName: 'foo',
    });
  });

  it('whitespace-trims input', () => {
    expect(parsePadUrl('   https://x/p/foo   ')).toEqual({
      serverUrl: 'https://x',
      padName: 'foo',
    });
  });

  it('returns null on a malformed URL', () => {
    expect(parsePadUrl('not a url')).toBeNull();
    expect(parsePadUrl('')).toBeNull();
  });

  it('returns null on a non-http(s) protocol', () => {
    expect(parsePadUrl('ftp://x/p/foo')).toBeNull();
    expect(parsePadUrl('javascript:alert(1)')).toBeNull();
  });

  it('returns null when the path has no /p/ segment', () => {
    expect(parsePadUrl('https://x/admin')).toBeNull();
    expect(parsePadUrl('https://x/')).toBeNull();
    expect(parsePadUrl('https://x')).toBeNull();
  });

  it('returns null when the pad name is empty', () => {
    expect(parsePadUrl('https://x/p/')).toBeNull();
  });
});
