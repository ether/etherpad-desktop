import { describe, it, expect, vi } from 'vitest';
import { PadViewFactory } from '../../../src/main/pads/pad-view-factory';

describe('PadViewFactory.create', () => {
  it('builds a WebContentsView with the correct partition and src', async () => {
    const loadURL = vi.fn().mockResolvedValue(undefined);
    const fakeWcv = {
      webContents: { loadURL, on: vi.fn(), id: 1 },
      setBounds: vi.fn(),
      setVisible: vi.fn(),
    };
    const ctorArgs: unknown[] = [];
    const FakeWebContentsView = vi.fn().mockImplementation((args) => {
      ctorArgs.push(args);
      return fakeWcv;
    });

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
    const fakeWcv = { webContents: { loadURL, on: vi.fn(), id: 1 }, setBounds: vi.fn(), setVisible: vi.fn() };
    const FakeWebContentsView = vi.fn().mockReturnValue(fakeWcv);
    const factory = new PadViewFactory({ WebContentsView: FakeWebContentsView as never });
    await factory.create({ workspaceId: 'a', src: '', preloadPath: '/p' });
    expect(loadURL).not.toHaveBeenCalled();
  });
});
