import { App } from '@capacitor/app';
import { dialogActions, useShellStore } from '@etherpad/shell/state';

/**
 * Touch + system-back gestures bundled into one install function so the
 * mobile entry point only needs a single setup call.
 *
 * 1. **Edge-swipe** (from left edge of the screen) expands the workspace
 *    rail when it's collapsed. From inside the screen rightward >50px
 *    while a tab is showing, collapses it.
 *
 * 2. **Android hardware/gesture back** closes the open dialog first, then
 *    collapses the rail if it's expanded, then falls through to the
 *    platform default (minimise the app).
 */
export function installGestureHandlers(): () => void {
  const SWIPE_EDGE_PX = 30;
  const SWIPE_THRESHOLD_PX = 60;
  const SWIPE_MAX_DRIFT_Y = 80;

  let startX = 0;
  let startY = 0;
  let fromLeftEdge = false;

  const onTouchStart = (e: TouchEvent): void => {
    const touch = e.touches[0];
    if (!touch) return;
    startX = touch.clientX;
    startY = touch.clientY;
    fromLeftEdge = startX < SWIPE_EDGE_PX;
  };

  const onTouchEnd = (e: TouchEvent): void => {
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (Math.abs(dy) > SWIPE_MAX_DRIFT_Y) return;

    const state = useShellStore.getState();
    if (state.openDialog) return; // Let dialog handle its own gestures.

    if (fromLeftEdge && dx > SWIPE_THRESHOLD_PX) {
      // Swipe right from the left edge → open rail.
      if (state.railCollapsed) state.toggleRailCollapsed();
    } else if (!fromLeftEdge && dx < -SWIPE_THRESHOLD_PX) {
      // Swipe left from inside → close rail (focus mode).
      if (!state.railCollapsed) state.toggleRailCollapsed();
    }
  };

  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true });

  // Android back-button handler.
  let removeBack: (() => void) | undefined;
  void App.addListener('backButton', () => {
    const state = useShellStore.getState();
    if (state.openDialog) {
      dialogActions.closeDialog();
      return;
    }
    if (!state.railCollapsed) {
      state.toggleRailCollapsed();
      return;
    }
    // Nothing to dismiss in the shell — let Android take over (minimise).
    void App.minimizeApp();
  }).then((sub) => {
    removeBack = (): void => {
      void sub.remove();
    };
  });

  return () => {
    document.removeEventListener('touchstart', onTouchStart);
    document.removeEventListener('touchend', onTouchEnd);
    removeBack?.();
  };
}
