import { describe, it, expect, vi } from 'vitest';
import { WindowManager } from '../../../src/main/windows/window-manager';

describe('WindowManager', () => {
  it('tracks created windows and forgets destroyed ones', () => {
    const created: Array<{ destroy: () => void; bounds: () => { x: number; y: number; width: number; height: number } }> = [];
    const factory = vi.fn().mockImplementation(() => {
      const w = {
        destroy: vi.fn(() => {
          const i = created.indexOf(w);
          if (i >= 0) created.splice(i, 1);
        }),
        bounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
      };
      created.push(w);
      return w;
    });
    const mgr = new WindowManager({ factory });
    const a = mgr.create({});
    const b = mgr.create({});
    expect(mgr.list()).toEqual([a, b]);
    mgr.destroy(a);
    expect(mgr.list()).toEqual([b]);
  });

  it('forget() drops the window without calling destroy on it', () => {
    const factory = vi.fn().mockImplementation(() => ({
      destroy: vi.fn(),
      bounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    }));
    const mgr = new WindowManager({ factory });
    const a = mgr.create({});
    mgr.forget(a);
    expect(mgr.list()).toEqual([]);
    expect(a.destroy).not.toHaveBeenCalled();
  });
});
