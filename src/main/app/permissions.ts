import type { Session } from 'electron';

/**
 * Permissions that we grant to any URL loaded in a workspace partition.
 * Narrow allow-list: media (camera/mic) for ep_webrtc and similar plugins,
 * clipboard for copy-paste, fullscreen for presentation mode.
 * Everything else (geolocation, notifications, MIDI, etc.) is denied.
 */
export const ALLOWED_PERMISSIONS = new Set([
  'media',
  'mediaKeySystem',
  'fullscreen',
  'clipboard-read',
  'clipboard-sanitized-write',
]);

export function shouldAllowPermission(permission: string): boolean {
  return ALLOWED_PERMISSIONS.has(permission);
}

/**
 * Install the permission request handler on a session so that plugins like
 * ep_webrtc can request camera/mic access without being silently denied.
 */
export function installPermissionHandler(sess: Session): void {
  sess.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(shouldAllowPermission(permission));
  });
}
