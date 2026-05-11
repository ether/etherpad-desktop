import { test, expect } from '@playwright/test';
import {
  adbClearAppData,
  adbDumpUi,
  adbLaunchApp,
  adbScreenshot,
  waitForUiText,
} from './android-fixtures.js';

/**
 * Smoke tests for the Capacitor Android build via adb input commands.
 *
 * Skipped by default; set ANDROID_E2E=1 to run. Requires:
 *   - ADB device at ADB_DEVICE (default `emulator-5554`)
 *   - APK installed: `adb install -r app-debug.apk`
 *
 * Headless emulator setup is documented in
 * `~/.claude/.../reference_android_toolchain.md`.
 *
 * Why adb input rather than Playwright/CDP — see comment in
 * `android-fixtures.ts`. tl;dr: WebView's CDP rejects the high-level
 * libraries' attach handshakes; adb input is the lowest-common-denominator.
 */
const RUN = Boolean(process.env.ANDROID_E2E);

test.describe('Android (emulator/device) smoke', () => {
  test.skip(!RUN, 'set ANDROID_E2E=1 to run; requires running emulator + installed APK');
  test.setTimeout(60_000);

  test.beforeEach(() => {
    adbClearAppData();
    adbLaunchApp();
  });

  test('first launch shows the AddWorkspaceDialog', async () => {
    // uiautomator dump exposes the WebView text content; wait for the
    // dialog heading to appear.
    await waitForUiText(/add an etherpad instance/i);
    adbScreenshot('test-results/android-first-launch.png');
    const dump = adbDumpUi();
    expect(dump).toMatch(/add an etherpad instance/i);
    expect(dump).toMatch(/etherpad url/i);
  });

  test('uiautomator can see the name + url + colour fields', async () => {
    await waitForUiText(/add an etherpad instance/i);
    const dump = adbDumpUi();
    // The shell renders Name + Etherpad URL labels + Colour palette.
    expect(dump).toMatch(/\bName\b/);
    expect(dump).toMatch(/Etherpad URL/i);
    expect(dump).toMatch(/Colour/i);
  });
});
