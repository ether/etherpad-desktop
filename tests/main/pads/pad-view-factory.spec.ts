import { describe, it, expect, vi } from 'vitest';
import { PadViewFactory, stripElectronTokens } from '../../../src/main/pads/pad-view-factory';

/** Build a constructable vi mock that returns `instance` from `new Ctor(...)`. */
function makeNewable<T>(instance: T, captor?: (args: unknown) => void) {
  // Must be a regular function (not arrow) so it can be called with `new`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return vi.fn(function (this: any, args: unknown) {
    if (captor) captor(args);
    return instance;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

describe('PadViewFactory.create', () => {
  it('builds a WebContentsView with the correct partition and src', async () => {
    const loadURL = vi.fn().mockResolvedValue(undefined);
    const fakeWcv = {
      webContents: {
        loadURL,
        on: vi.fn(),
        getUserAgent: vi.fn(() => 'Mozilla/5.0 X Chrome/146.0 Electron/41.5 Safari/537.36'),
        setUserAgent: vi.fn(),
        id: 1,
      },
      setBounds: vi.fn(),
      setVisible: vi.fn(),
    };
    const ctorArgs: unknown[] = [];
    const FakeWebContentsView = makeNewable(fakeWcv, (a) => ctorArgs.push(a));

    const factory = new PadViewFactory({
      WebContentsView: FakeWebContentsView as unknown as never,
    });
    const view = await factory.create({
      workspaceId: 'abc',
      src: 'https://x/p/a',
      preloadPath: '/preload.cjs',
    });

    expect(FakeWebContentsView).toHaveBeenCalledTimes(1);
    expect(ctorArgs[0]).toEqual({
      webPreferences: {
        partition: 'persist:ws-abc',
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: '/preload.cjs',
      },
    });
    expect(loadURL).toHaveBeenCalledWith('https://x/p/a');
    expect(view).toBe(fakeWcv);
  });

  it('does not load if src is the empty string (cold-restore lazy case)', async () => {
    const loadURL = vi.fn();
    const fakeWcv = {
      webContents: {
        loadURL,
        on: vi.fn(),
        getUserAgent: vi.fn(() => 'Mozilla/5.0 X Electron/41.5'),
        setUserAgent: vi.fn(),
        id: 1,
      },
      setBounds: vi.fn(),
      setVisible: vi.fn(),
    };
    const FakeWebContentsView = makeNewable(fakeWcv);
    const factory = new PadViewFactory({ WebContentsView: FakeWebContentsView as never });
    await factory.create({ workspaceId: 'a', src: '', preloadPath: '/p' });
    expect(loadURL).not.toHaveBeenCalled();
  });

  // REGRESSION: 2026-05-05 — ep_webrtc was silently disabling A/V chat
  // because it user-agent-sniffs and rejects strings containing
  // "Electron/". The factory now strips Electron-specific tokens from
  // the UA before any load happens.
  it('strips Electron-specific tokens from the UA before the first load', async () => {
    const loadURL = vi.fn().mockResolvedValue(undefined);
    const setUserAgent = vi.fn();
    const fakeWcv = {
      webContents: {
        loadURL,
        on: vi.fn(),
        getUserAgent: vi.fn(() => 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 etherpad-desktop/0.1.0 Chrome/146.0.7680.216 Electron/41.5.0 Safari/537.36'),
        setUserAgent,
        id: 1,
      },
      setBounds: vi.fn(),
      setVisible: vi.fn(),
    };
    const FakeWebContentsView = makeNewable(fakeWcv);
    const factory = new PadViewFactory({ WebContentsView: FakeWebContentsView as never });
    await factory.create({ workspaceId: 'abc', src: 'https://x/p/a', preloadPath: '/p' });

    expect(setUserAgent).toHaveBeenCalledTimes(1);
    const cleaned = setUserAgent.mock.calls[0]![0] as string;
    expect(cleaned).not.toContain('Electron/');
    expect(cleaned).not.toContain('etherpad-desktop/');
    // Important Chrome+platform tokens preserved so server-side feature
    // detection still works.
    expect(cleaned).toContain('Chrome/146.0.7680.216');
    expect(cleaned).toContain('Linux x86_64');
    expect(cleaned).toContain('Safari/537.36');
    // setUserAgent fires BEFORE loadURL.
    const setOrder = setUserAgent.mock.invocationCallOrder[0]!;
    const loadOrder = loadURL.mock.invocationCallOrder[0]!;
    expect(setOrder).toBeLessThan(loadOrder);
  });
});

describe('stripElectronTokens', () => {
  it('removes Electron/<version>', () => {
    expect(stripElectronTokens('A B Electron/41.5.0 C')).toBe('A B C');
  });

  it('removes etherpad-desktop/<version>', () => {
    expect(stripElectronTokens('A etherpad-desktop/0.1.0 B')).toBe('A B');
  });

  it('removes both', () => {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 etherpad-desktop/0.1.0 Chrome/146.0.7680.216 Electron/41.5.0 Safari/537.36';
    const out = stripElectronTokens(ua);
    expect(out).toBe('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/146.0.7680.216 Safari/537.36');
  });

  it('is a no-op when the string contains neither token', () => {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/146.0.7680.216 Safari/537.36';
    expect(stripElectronTokens(ua)).toBe(ua);
  });

  it('collapses double spaces left behind', () => {
    expect(stripElectronTokens('A  Electron/1.0  B')).toBe('A B');
  });

  it('handles tokens at start or end of string', () => {
    expect(stripElectronTokens('Electron/1.0 A B')).toBe('A B');
    expect(stripElectronTokens('A B Electron/1.0')).toBe('A B');
  });
});
