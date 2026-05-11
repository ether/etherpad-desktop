import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  BaseWindow: class {},
  WebContentsView: class {},
}));

import { computeMainAreaRect, COLLAPSED_LEFT_GUTTER } from '../../../src/main/windows/app-window';

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

  // REGRESSION: 2026-05-05 — when the rail collapses, the WebContentsView
  // must NOT cover x=0..gutter, otherwise the DOM-rendered expand handle
  // becomes unreachable (the native view is painted above the renderer in
  // z-order). Verify the gutter is reserved.
  it('reserves COLLAPSED_LEFT_GUTTER on the left when railCollapsed=true', () => {
    expect(computeMainAreaRect({ width: 1200, height: 800 }, { railCollapsed: true })).toEqual({
      x: COLLAPSED_LEFT_GUTTER,
      y: 40,
      width: 1200 - COLLAPSED_LEFT_GUTTER,
      height: 800 - 40,
    });
    expect(COLLAPSED_LEFT_GUTTER).toBeGreaterThan(0);
  });
});
