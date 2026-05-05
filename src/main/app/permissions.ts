import type { Session } from 'electron';
import { getLogger } from '../logging/logger.js';

/**
 * Permissions we grant to URLs loaded inside a workspace partition.
 *
 * `media` covers getUserMedia (camera/mic) — needed by ep_webrtc and any
 * plugin that records audio/video. `display-capture` covers
 * getDisplayMedia for screen sharing. `clipboard-*` covers the modern
 * Clipboard API used by Etherpad's copy/paste paths.
 *
 * Anything not on this list (geolocation, notifications, MIDI, USB, …)
 * is denied silently — Etherpad doesn't need them and an Etherpad
 * instance asking for them is suspicious.
 */
export const ALLOWED_PERMISSIONS = new Set([
  'media',
  'mediaKeySystem',
  'display-capture',
  'fullscreen',
  'clipboard-read',
  'clipboard-sanitized-write',
]);

export function shouldAllowPermission(permission: string): boolean {
  return ALLOWED_PERMISSIONS.has(permission);
}

/**
 * Install permission handlers on a session so plugins like ep_webrtc can
 * actually function. Three handlers, all needed:
 *
 *   1. `setPermissionRequestHandler` — fires when JS calls
 *      getUserMedia/etc. Asynchronous; in a browser this is where the
 *      "Allow camera?" prompt lives.
 *   2. `setPermissionCheckHandler`   — fires when JS calls
 *      `navigator.permissions.query({name: …})`. Synchronous. Plugins
 *      often gate UI on this — if it returns false they assume the
 *      feature is unavailable and don't even render the toggle, which
 *      makes their button look like it does nothing.
 *   3. `setDevicePermissionHandler`  — fires when picking a specific
 *      device (a particular camera or mic). Without it, even a granted
 *      `media` permission can fail at the device-selection step.
 *
 * Behaviour right now is deny-by-default, allow-listed; future work can
 * swap the request handler for a `dialog.showMessageBox` prompt to
 * match standard browser UX.
 */
export function installPermissionHandler(sess: Session): void {
  const log = getLogger('permissions');

  sess.setPermissionRequestHandler((wc, permission, callback, details) => {
    const allowed = shouldAllowPermission(permission);
    void log.then((l) =>
      l.info('permission request', {
        permission,
        allowed,
        url: details?.requestingUrl,
        webContentsId: wc?.id,
      }),
    );
    callback(allowed);
  });

  sess.setPermissionCheckHandler((_wc, permission, requestingOrigin) => {
    const allowed = shouldAllowPermission(permission);
    void log.then((l) =>
      l.debug('permission check', { permission, allowed, requestingOrigin }),
    );
    return allowed;
  });

  // setDevicePermissionHandler is a function on Session in Electron 22+;
  // accept any device when the parent permission ('media') would be
  // allowed — we don't have a per-device picker UI in v0.
  const sessAny = sess as unknown as {
    setDevicePermissionHandler?: (
      h: (details: { deviceType: string; origin: string }) => boolean,
    ) => void;
  };
  if (typeof sessAny.setDevicePermissionHandler === 'function') {
    sessAny.setDevicePermissionHandler(({ deviceType, origin }) => {
      // 'usb' / 'serial' / 'hid' / 'bluetooth' get denied; only media-style
      // device categories pass through.
      const allowed = deviceType === 'audioinput'
        || deviceType === 'videoinput'
        || deviceType === 'audiooutput';
      void log.then((l) =>
        l.debug('device permission check', { deviceType, origin, allowed }),
      );
      return allowed;
    });
  }
}
