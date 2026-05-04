import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  BaseWindow: class {},
  WebContentsView: class {},
}));

import { computeMainAreaRect } from '../../../src/main/windows/app-window';

describe('computeMainAreaRect', () => {
  it('reserves space for the workspace rail (left) and tab strip (top)', () => {
    expect(computeMainAreaRect({ width: 1200, height: 800 })).toEqual({
      x: 64 + 240,
      y: 40,
      width: 1200 - (64 + 240),
      height: 800 - 40,
    });
  });

  it('clamps to non-negative width/height', () => {
    expect(computeMainAreaRect({ width: 100, height: 10 })).toEqual({
      x: 304,
      y: 40,
      width: 0,
      height: 0,
    });
  });
});
