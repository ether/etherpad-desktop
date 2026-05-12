import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

/**
 * Adb-based driver for an Android emulator (or USB-attached device).
 *
 * Why adb input rather than CDP / puppeteer? Android WebView's stripped-down
 * CDP rejects `Browser.setDownloadBehavior` (Playwright) and
 * `Target.getBrowserContexts` (puppeteer-core), so the higher-level libraries
 * can't attach cleanly. adb input commands work on every WebView version and
 * cover the three primitives we need: tap, type, screenshot.
 *
 * Coordinate-based taps are inherently brittle vs the DOM-selector approach
 * — these tests are paired with `screencap` snapshots so visual diffs catch
 * any layout drift.
 */

const APP_ID = 'com.etherpad.mobile';
const DEFAULT_DEVICE = process.env.ADB_DEVICE ?? 'emulator-5554';
const ADB = process.env.ADB ?? `${process.env.HOME}/Android/Sdk/platform-tools/adb`;

function adb(args: string[], device = DEFAULT_DEVICE): string {
  const out = spawnSync(ADB, ['-s', device, ...args], { encoding: 'utf8' });
  if (out.status !== 0) {
    throw new Error(`adb ${args.join(' ')} failed: ${out.stderr || out.stdout}`);
  }
  return out.stdout;
}

export function adbClearAppData(device = DEFAULT_DEVICE): void {
  adb(['shell', 'pm', 'clear', APP_ID], device);
}

export function adbForceStop(device = DEFAULT_DEVICE): void {
  adb(['shell', 'am', 'force-stop', APP_ID], device);
}

export function adbLaunchApp(device = DEFAULT_DEVICE): void {
  adb(['shell', 'am', 'start', '-n', `${APP_ID}/.MainActivity`], device);
}

/** Adb tap at (x, y). Coordinates are device pixels. */
export function adbTap(x: number, y: number, device = DEFAULT_DEVICE): void {
  adb(['shell', 'input', 'tap', String(x), String(y)], device);
}

/** Adb text input. Spaces become %s; special chars must be escaped by caller. */
export function adbText(text: string, device = DEFAULT_DEVICE): void {
  adb(['shell', 'input', 'text', text.replace(/ /g, '%s')], device);
}

export function adbBack(device = DEFAULT_DEVICE): void {
  adb(['shell', 'input', 'keyevent', 'KEYCODE_BACK'], device);
}

export function adbHome(device = DEFAULT_DEVICE): void {
  adb(['shell', 'input', 'keyevent', 'KEYCODE_HOME'], device);
}

/** Capture a PNG screenshot. Returns the file path for convenience. */
export function adbScreenshot(toPath: string, device = DEFAULT_DEVICE): string {
  const buf = spawnSync(ADB, ['-s', device, 'exec-out', 'screencap', '-p']);
  if (buf.status !== 0) throw new Error(`screencap failed: ${buf.stderr.toString()}`);
  writeFileSync(toPath, buf.stdout);
  return toPath;
}

/**
 * Dump the foreground app's UI hierarchy as XML. Useful for asserting on
 * native UI state when a coordinate-tap is too coarse. Works for the
 * WebView too — its accessibility nodes are exposed via the same XML.
 */
export function adbDumpUi(device = DEFAULT_DEVICE): string {
  // uiautomator writes to /sdcard/window_dump.xml then we pull it.
  adb(['shell', 'uiautomator', 'dump', '--compressed', '/sdcard/window_dump.xml'], device);
  return adb(['shell', 'cat', '/sdcard/window_dump.xml'], device);
}

/** Wait for the UI dump to contain `text` (regex matched). Polls every 500ms. */
export async function waitForUiText(needle: RegExp, timeoutMs = 15_000, device = DEFAULT_DEVICE): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const dump = adbDumpUi(device);
      if (needle.test(dump)) return;
    } catch {
      // ignore transient dump failures (uiautomator can race the WebView)
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`UI text matching ${needle} not found within ${timeoutMs}ms`);
}

export const APP = APP_ID;
