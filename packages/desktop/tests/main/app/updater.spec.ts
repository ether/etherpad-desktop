import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

// Mock electron so `app.isPackaged` is configurable between tests.
const mockApp = vi.hoisted(() => ({ isPackaged: false }));

vi.mock('electron', () => ({ app: mockApp }));

import { createUpdater } from '../../../src/main/app/updater';
import type { AutoUpdaterImpl } from '../../../src/main/app/updater';

const noopLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

/** Build a fake autoUpdater that is also an EventEmitter for event dispatch. */
function makeFakeUpdater() {
  const ee = new EventEmitter();
  const fake: AutoUpdaterImpl & { _ee: typeof ee; checkForUpdates: ReturnType<typeof vi.fn>; quitAndInstall: ReturnType<typeof vi.fn> } = {
    _ee: ee,
    autoDownload: false,
    autoInstallOnAppQuit: true,
    on: (event: string, listener: (...args: never[]) => void) => {
      ee.on(event, listener as (...args: unknown[]) => void);
    },
    checkForUpdates: vi.fn().mockResolvedValue(null),
    quitAndInstall: vi.fn(),
  };
  return fake;
}

beforeEach(() => {
  mockApp.isPackaged = false;
  noopLog.warn.mockClear();
});

describe('createUpdater — not packaged (dev mode)', () => {
  it('returns state { kind: "unsupported" } immediately', async () => {
    mockApp.isPackaged = false;
    const ctl = await createUpdater({ log: noopLog });
    expect(ctl.getState()).toMatchObject({ kind: 'unsupported' });
  });

  it('check() is a no-op', async () => {
    const ctl = await createUpdater({ log: noopLog });
    await expect(ctl.check()).resolves.toBeUndefined();
  });

  it('installAndRestart() is a no-op', async () => {
    const ctl = await createUpdater({ log: noopLog });
    expect(() => ctl.installAndRestart()).not.toThrow();
  });
});

describe('createUpdater — injected impl (packaged behaviour)', () => {
  it('initial state is { kind: "idle" } when impl is provided', async () => {
    const fake = makeFakeUpdater();
    const ctl = await createUpdater({ log: noopLog, impl: fake });
    expect(ctl.getState()).toEqual({ kind: 'idle' });
  });

  it('sets autoDownload = true and autoInstallOnAppQuit = false', async () => {
    const fake = makeFakeUpdater();
    await createUpdater({ log: noopLog, impl: fake });
    expect(fake.autoDownload).toBe(true);
    expect(fake.autoInstallOnAppQuit).toBe(false);
  });

  it('checking-for-update event → state { kind: "checking" }', async () => {
    const fake = makeFakeUpdater();
    const ctl = await createUpdater({ log: noopLog, impl: fake });
    fake._ee.emit('checking-for-update');
    expect(ctl.getState()).toEqual({ kind: 'checking' });
  });

  it('update-available event → state { kind: "available", version }', async () => {
    const fake = makeFakeUpdater();
    const ctl = await createUpdater({ log: noopLog, impl: fake });
    fake._ee.emit('update-available', { version: '1.2.3' });
    expect(ctl.getState()).toEqual({ kind: 'available', version: '1.2.3' });
  });

  it('update-not-available event → state { kind: "idle" }', async () => {
    const fake = makeFakeUpdater();
    const ctl = await createUpdater({ log: noopLog, impl: fake });
    fake._ee.emit('checking-for-update');
    fake._ee.emit('update-not-available');
    expect(ctl.getState()).toEqual({ kind: 'idle' });
  });

  it('download-progress event → state { kind: "downloading", percent: rounded }', async () => {
    const fake = makeFakeUpdater();
    const ctl = await createUpdater({ log: noopLog, impl: fake });
    fake._ee.emit('download-progress', { percent: 42.7 });
    expect(ctl.getState()).toEqual({ kind: 'downloading', percent: 43 });
  });

  it('update-downloaded event → state { kind: "ready", version }', async () => {
    const fake = makeFakeUpdater();
    const ctl = await createUpdater({ log: noopLog, impl: fake });
    fake._ee.emit('update-downloaded', { version: '2.0.0' });
    expect(ctl.getState()).toEqual({ kind: 'ready', version: '2.0.0' });
  });

  it('error event → state { kind: "error", message }', async () => {
    const fake = makeFakeUpdater();
    const ctl = await createUpdater({ log: noopLog, impl: fake });
    fake._ee.emit('error', new Error('network failure'));
    expect(ctl.getState()).toEqual({ kind: 'error', message: 'network failure' });
    expect(noopLog.warn).toHaveBeenCalledWith('updater error', { message: 'network failure' });
  });

  it('check() calls checkForUpdates()', async () => {
    const fake = makeFakeUpdater();
    const ctl = await createUpdater({ log: noopLog, impl: fake });
    await ctl.check();
    expect(fake.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('check() transitions to error state when checkForUpdates throws', async () => {
    const fake = makeFakeUpdater();
    fake.checkForUpdates.mockRejectedValueOnce(new Error('timeout'));
    const ctl = await createUpdater({ log: noopLog, impl: fake });
    await ctl.check();
    expect(ctl.getState()).toEqual({ kind: 'error', message: 'timeout' });
  });

  it('installAndRestart() calls quitAndInstall(true, true)', async () => {
    const fake = makeFakeUpdater();
    const ctl = await createUpdater({ log: noopLog, impl: fake });
    ctl.installAndRestart();
    expect(fake.quitAndInstall).toHaveBeenCalledWith(true, true);
  });

  it('onStateChange returns an unsubscribe fn', async () => {
    const fake = makeFakeUpdater();
    const ctl = await createUpdater({ log: noopLog, impl: fake });
    const cb = vi.fn();
    const off = ctl.onStateChange(cb);
    fake._ee.emit('checking-for-update');
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    fake._ee.emit('update-not-available');
    // cb should NOT have been called a second time after unsubscribe
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('stop() clears the interval timer', async () => {
    vi.useFakeTimers();
    const fake = makeFakeUpdater();
    const ctl = await createUpdater({ log: noopLog, impl: fake });
    ctl.startAutoCheck(1000);
    // Called once immediately on startAutoCheck
    expect(fake.checkForUpdates).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2000);
    expect(fake.checkForUpdates).toHaveBeenCalledTimes(3);
    ctl.stop();
    vi.advanceTimersByTime(5000);
    // No more calls after stop
    expect(fake.checkForUpdates).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});
