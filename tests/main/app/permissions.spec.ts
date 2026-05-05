import { describe, it, expect, vi } from 'vitest';
import { shouldAllowPermission, ALLOWED_PERMISSIONS, installPermissionHandler } from '../../../src/main/app/permissions';

describe('shouldAllowPermission', () => {
  it('allows media (camera/mic for ep_webrtc)', () => {
    expect(shouldAllowPermission('media')).toBe(true);
  });

  it('allows mediaKeySystem', () => {
    expect(shouldAllowPermission('mediaKeySystem')).toBe(true);
  });

  it('allows fullscreen', () => {
    expect(shouldAllowPermission('fullscreen')).toBe(true);
  });

  it('allows clipboard-read', () => {
    expect(shouldAllowPermission('clipboard-read')).toBe(true);
  });

  it('allows clipboard-sanitized-write', () => {
    expect(shouldAllowPermission('clipboard-sanitized-write')).toBe(true);
  });

  it('denies geolocation', () => {
    expect(shouldAllowPermission('geolocation')).toBe(false);
  });

  it('denies notifications', () => {
    expect(shouldAllowPermission('notifications')).toBe(false);
  });

  it('denies midi', () => {
    expect(shouldAllowPermission('midi')).toBe(false);
  });

  it('denies midiSysex', () => {
    expect(shouldAllowPermission('midiSysex')).toBe(false);
  });

  it('denies pointerLock', () => {
    expect(shouldAllowPermission('pointerLock')).toBe(false);
  });

  it('denies unknown / arbitrary permission strings', () => {
    expect(shouldAllowPermission('openExternal')).toBe(false);
    expect(shouldAllowPermission('unknown-perm')).toBe(false);
    expect(shouldAllowPermission('')).toBe(false);
  });

  it('ALLOWED_PERMISSIONS set has expected size (5 entries)', () => {
    expect(ALLOWED_PERMISSIONS.size).toBe(5);
  });
});

describe('installPermissionHandler', () => {
  it('calls setPermissionRequestHandler on the session', () => {
    const mockSess = { setPermissionRequestHandler: vi.fn() };
    installPermissionHandler(mockSess as never);
    expect(mockSess.setPermissionRequestHandler).toHaveBeenCalledTimes(1);
    expect(typeof mockSess.setPermissionRequestHandler.mock.calls[0]![0]).toBe('function');
  });

  it('handler grants allowed permissions via callback(true)', () => {
    const mockSess = { setPermissionRequestHandler: vi.fn() };
    installPermissionHandler(mockSess as never);
    const handler = mockSess.setPermissionRequestHandler.mock.calls[0]![0] as (
      wc: unknown,
      perm: string,
      cb: (allow: boolean) => void,
    ) => void;

    const allowedPerms = ['media', 'mediaKeySystem', 'fullscreen', 'clipboard-read', 'clipboard-sanitized-write'];
    for (const perm of allowedPerms) {
      const cb = vi.fn();
      handler({}, perm, cb);
      expect(cb).toHaveBeenCalledWith(true);
    }
  });

  it('handler denies disallowed permissions via callback(false)', () => {
    const mockSess = { setPermissionRequestHandler: vi.fn() };
    installPermissionHandler(mockSess as never);
    const handler = mockSess.setPermissionRequestHandler.mock.calls[0]![0] as (
      wc: unknown,
      perm: string,
      cb: (allow: boolean) => void,
    ) => void;

    const deniedPerms = ['geolocation', 'notifications', 'midi', 'openExternal'];
    for (const perm of deniedPerms) {
      const cb = vi.fn();
      handler({}, perm, cb);
      expect(cb).toHaveBeenCalledWith(false);
    }
  });
});
