import { describe, it, expect } from 'vitest';
import { normalizeServerUrl, padUrl } from '@shared/url';

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
