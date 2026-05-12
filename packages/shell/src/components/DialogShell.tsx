import React, { useEffect, useRef } from 'react';
import { dialogActions } from '../state/store.js';

export type DialogShellProps = {
  /** Stable id for aria-labelledby; pass through to your <h2 id={...}>. */
  labelledBy: string;
  /** When true (default), Escape closes the dialog. */
  dismissOnEscape?: boolean;
  /** When true (default), clicking the dimmed overlay closes the dialog. */
  dismissOnOverlayClick?: boolean;
  /** Optional: invoked instead of dialogActions.closeDialog(). */
  onDismiss?: () => void;
  /** Width override; default 420. */
  width?: number;
  /** Extra class names to add to the overlay element (e.g. 'dialog-overlay-top'). */
  overlayClassName?: string;
  children: React.ReactNode;
};

export function DialogShell(props: DialogShellProps): React.JSX.Element {
  const {
    labelledBy,
    dismissOnEscape = true,
    dismissOnOverlayClick = true,
    onDismiss,
    width = 420,
    overlayClassName,
    children,
  } = props;
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const dismiss = () => {
    if (onDismiss) onDismiss();
    else dialogActions.closeDialog();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dismissOnEscape && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        dismiss();
        return;
      }
      // Focus trap: keep Tab/Shift+Tab inside the panel. Without this, Tab
      // could focus the embedded WebContentsView (the pad) or rail buttons
      // behind the dialog — which is both confusing and a screen-reader
      // accessibility issue.
      if (e.key === 'Tab') {
        const node = panelRef.current;
        if (!node) return;
        const focusables = Array.from(
          node.querySelectorAll<HTMLElement>(
            'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute('aria-hidden'));
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        const activeEl = document.activeElement as HTMLElement | null;
        if (e.shiftKey && activeEl === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && activeEl === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    // Capture phase so we beat handlers inside the dialog content.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-focus the first focusable element so Escape works without manual
  // click; restore focus to the previously focused element on unmount so
  // keyboard users don't end up at the top of the document.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const node = panelRef.current;
    const focusable = node?.querySelector<HTMLElement>(
      'input, textarea, select, button, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
    return () => {
      // Only restore if the previously focused element is still in the DOM
      // and focusable; otherwise let the browser pick a sensible default.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, []);

  return (
    <div
      ref={overlayRef}
      className={`dialog-overlay${overlayClassName ? ` ${overlayClassName}` : ''}`}
      onMouseDown={(e) => {
        // Only dismiss when the user clicks DIRECTLY on the overlay, not on
        // the panel or any child. mousedown (not click) avoids treating
        // text-selection drags that end on the overlay as dismissals.
        if (dismissOnOverlayClick && e.target === overlayRef.current) {
          dismiss();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="dialog-panel"
        style={{ width: `min(${width}px, calc(100vw - 16px))` }}
      >
        {children}
      </div>
    </div>
  );
}
