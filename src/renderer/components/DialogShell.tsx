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
    if (!dismissOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        dismiss();
      }
    };
    // Listen on window so the key works no matter where focus is inside the
    // dialog (panel, input, button, anywhere). Capture phase so we don't lose
    // it to other handlers.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-focus the first focusable element so Escape works without manual click.
  useEffect(() => {
    const node = panelRef.current;
    if (!node) return;
    const focusable = node.querySelector<HTMLElement>(
      'input, textarea, select, button, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
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
        style={{ width }}
      >
        {children}
      </div>
    </div>
  );
}
