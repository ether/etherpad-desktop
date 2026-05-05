import { describe, it, expect, vi } from 'vitest';
import { shouldAllowPermission, ALLOWED_PERMISSIONS, installPermissionHandler } from '../../../src/main/app/permissions';

describe('shouldAllowPermission', () => {
  it('allows media (camera/mic for ep_webrtc)', () => {
    expect(shouldAllowPermission('media')).toBe(true);
  });

  it('allows mediaKeySystem', () => {
    expect(shouldAllowPermission('mediaKeySystem')).toBe(true);
  });

  it('allows display-capture (screen sharing inside ep_webrtc)', () => {
    expect(shouldAllowPermission('display-capture')).toBe(true);
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

  it('ALLOWED_PERMISSIONS set has expected size (6 entries)', () => {
    expect(ALLOWED_PERMISSIONS.size).toBe(6);
  });
});

function makeMockSession() {
  return {
    setPermissionRequestHandler: vi.fn(),
    setPermissionCheckHandler: vi.fn(),
    setDevicePermissionHandler: vi.fn(),
  };
}

describe('installPermissionHandler', () => {
  it('installs all three handlers on the session', () => {
    const mockSess = makeMockSession();
    installPermissionHandler(mockSess as never);
    expect(mockSess.setPermissionRequestHandler).toHaveBeenCalledTimes(1);
    expect(mockSess.setPermissionCheckHandler).toHaveBeenCalledTimes(1);
    expect(mockSess.setDevicePermissionHandler).toHaveBeenCalledTimes(1);
  });

  it('request handler grants allowed permissions via callback(true)', () => {
    const mockSess = makeMockSession();
    installPermissionHandler(mockSess as never);
    const handler = mockSess.setPermissionRequestHandler.mock.calls[0]![0] as (
      wc: unknown,
      perm: string,
      cb: (allow: boolean) => void,
      details?: unknown,
    ) => void;

    const allowedPerms = ['media', 'mediaKeySystem', 'display-capture', 'fullscreen', 'clipboard-read', 'clipboard-sanitized-write'];
    for (const perm of allowedPerms) {
      const cb = vi.fn();
      handler({}, perm, cb, {});
      expect(cb).toHaveBeenCalledWith(true);
    }
  });

  it('request handler denies disallowed permissions via callback(false)', () => {
    const mockSess = makeMockSession();
    installPermissionHandler(mockSess as never);
    const handler = mockSess.setPermissionRequestHandler.mock.calls[0]![0] as (
      wc: unknown,
      perm: string,
      cb: (allow: boolean) => void,
      details?: unknown,
    ) => void;

    const deniedPerms = ['geolocation', 'notifications', 'midi', 'openExternal'];
    for (const perm of deniedPerms) {
      const cb = vi.fn();
      handler({}, perm, cb, {});
      expect(cb).toHaveBeenCalledWith(false);
    }
  });

  // REGRESSION: 2026-05-05 — without setPermissionCheckHandler,
  // navigator.permissions.query({name:'camera'}) returns 'denied' so
  // ep_webrtc's UI gate fires and the toggle silently no-ops.
  it('check handler returns true for allowed permissions', () => {
    const mockSess = makeMockSession();
    installPermissionHandler(mockSess as never);
    const checkHandler = mockSess.setPermissionCheckHandler.mock.calls[0]![0] as (
      wc: unknown,
      perm: string,
      origin: string,
    ) => boolean;
    expect(checkHandler({}, 'media', 'https://x')).toBe(true);
    expect(checkHandler({}, 'fullscreen', 'https://x')).toBe(true);
    expect(checkHandler({}, 'clipboard-read', 'https://x')).toBe(true);
    expect(checkHandler({}, 'display-capture', 'https://x')).toBe(true);
  });

  it('check handler returns false for disallowed permissions', () => {
    const mockSess = makeMockSession();
    installPermissionHandler(mockSess as never);
    const checkHandler = mockSess.setPermissionCheckHandler.mock.calls[0]![0] as (
      wc: unknown,
      perm: string,
      origin: string,
    ) => boolean;
    expect(checkHandler({}, 'geolocation', 'https://x')).toBe(false);
    expect(checkHandler({}, 'notifications', 'https://x')).toBe(false);
  });

  it('device permission handler allows audio/video devices, denies USB/serial', () => {
    const mockSess = makeMockSession();
    installPermissionHandler(mockSess as never);
    const devHandler = mockSess.setDevicePermissionHandler.mock.calls[0]![0] as (
      details: { deviceType: string; origin: string },
    ) => boolean;
    expect(devHandler({ deviceType: 'audioinput', origin: 'https://x' })).toBe(true);
    expect(devHandler({ deviceType: 'videoinput', origin: 'https://x' })).toBe(true);
    expect(devHandler({ deviceType: 'audiooutput', origin: 'https://x' })).toBe(true);
    expect(devHandler({ deviceType: 'usb', origin: 'https://x' })).toBe(false);
    expect(devHandler({ deviceType: 'serial', origin: 'https://x' })).toBe(false);
    expect(devHandler({ deviceType: 'hid', origin: 'https://x' })).toBe(false);
  });
});
