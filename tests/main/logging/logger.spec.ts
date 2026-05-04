import { describe, it, expect } from 'vitest';
import { redactForLog } from '../../../src/main/logging/logger';

describe('redactForLog', () => {
  it('passes through plain primitives', () => {
    expect(redactForLog('hello')).toBe('hello');
    expect(redactForLog(42)).toBe(42);
    expect(redactForLog(true)).toBe(true);
    expect(redactForLog(null)).toBeNull();
  });

  it('redacts known sensitive keys', () => {
    expect(redactForLog({ padName: 'standup', workspaceId: 'abc' })).toEqual({
      padName: '[redacted]',
      workspaceId: 'abc',
    });
  });

  it('redacts serverUrl', () => {
    expect(redactForLog({ serverUrl: 'https://x' })).toEqual({ serverUrl: '[redacted]' });
  });

  it('redacts password and Authorization headers', () => {
    expect(redactForLog({ password: 'p', Authorization: 'Bearer x' })).toEqual({
      password: '[redacted]',
      Authorization: '[redacted]',
    });
  });

  it('recurses into nested objects and arrays', () => {
    expect(
      redactForLog({ a: { padName: 'x' }, b: [{ password: 'y' }] }),
    ).toEqual({
      a: { padName: '[redacted]' },
      b: [{ password: '[redacted]' }],
    });
  });
});
