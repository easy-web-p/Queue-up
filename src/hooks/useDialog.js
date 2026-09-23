/**
 * ============================================================================
 * 🪟 WHAT A DIALOG OWES THE PERSON IN FRONT OF IT
 * ============================================================================
 *
 * This app had six modals and no two of them agreed on what a modal is.
 *
 *   ChatModal            no role, no label, no Escape
 *   SellerAssistantModal no role, no label, no Escape
 *   PdpaPolicyModal      no role, no label, no Escape
 *   ClientCartModal      role + label, no Escape
 *   ClientLoyaltyDrawer  role + label + Escape
 *   UserProfile          two overlays, neither with any of it
 *
 * and not one of the six trapped focus, restored it on close, or stopped the
 * page behind from scrolling. What that adds up to, in order of how much it
 * costs the person:
 *
 *  - **Tab walks out the back.** Focus leaves the dialog and lands on the page
 *    underneath, which is still there, still focusable, and now invisible
 *    behind a dim layer. A keyboard user tabs into a page they cannot see and
 *    has no way of knowing they have left. In the account-deletion dialog, the
 *    controls behind it are the profile they are deleting.
 *  - **Escape does nothing.** Four of the six could only be dismissed by
 *    finding and clicking the ✕, or by clicking the backdrop — which is not a
 *    keyboard gesture at all. That backdrop click is why several of these
 *    elements looked like unreachable controls; the answer is not to make the
 *    backdrop a tab stop, it is to honour Escape.
 *  - **Nothing says a dialog opened.** Without `role="dialog"` and a label, a
 *    screen reader announces nothing on open and nothing bounds it: the
 *    contents read as more of the same page.
 *  - **Focus is lost on close.** It returns to the top of the document, so a
 *    keyboard user re-traverses the page to get back to where they were.
 *  - **The page scrolls underneath.** On a phone, flicking inside a short
 *    dialog scrolls the page behind it, and closing leaves the reader
 *    somewhere they never navigated to.
 *
 * Usage:
 *
 *   const { dialogRef, dialogProps, backdropProps } = useDialog({
 *     isOpen, onClose, labelledBy: 'cart-modal-title',
 *   });
 *   ...
 *   <div className="backdrop" {...backdropProps}>
 *     <div className="panel" ref={dialogRef} {...dialogProps}> ... </div>
 *   </div>
 */

import { useCallback, useEffect, useRef } from 'react';

/** Everything that can hold focus, minus what is currently unreachable. */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableWithin(node) {
  if (!node) return [];
  return Array.from(node.querySelectorAll(FOCUSABLE)).filter(
    // offsetParent is null for anything display:none, so a collapsed section
    // inside the dialog does not become an invisible stop on the way round.
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

/**
 * @param {object} options
 * @param {boolean} options.isOpen
 * @param {() => void} options.onClose      - called on Escape and on backdrop click
 * @param {string} [options.labelledBy]     - id of the element holding the title
 * @param {string} [options.label]          - a literal name, when there is no title element
 * @param {boolean} [options.closeOnBackdrop=true]
 * @param {'dialog'|'alertdialog'} [options.role='dialog']
 */
export function useDialog({
  isOpen,
  onClose,
  labelledBy,
  label,
  closeOnBackdrop = true,
  role = 'dialog',
}) {
  const dialogRef = useRef(null);
  const openerRef = useRef(null);

  // Remember who opened it, before focus moves anywhere.
  useEffect(() => {
    if (!isOpen) return undefined;
    openerRef.current = document.activeElement;
    return () => {
      const opener = openerRef.current;
      // Only if it is still on the page and still focusable — a dialog that
      // deleted the thing that opened it must not throw on the way out.
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus();
      }
    };
  }, [isOpen]);

  // Move focus in, so the first Tab continues from inside rather than from
  // the top of the document.
  useEffect(() => {
    if (!isOpen) return;
    const node = dialogRef.current;
    if (!node) return;
    const first = focusableWithin(node)[0];
    if (first) {
      first.focus();
    } else {
      // Nothing to land on: make the panel itself the target rather than
      // leaving focus on the page behind.
      node.setAttribute('tabindex', '-1');
      node.focus();
    }
  }, [isOpen]);

  // Escape closes; Tab cycles inside.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const node = dialogRef.current;
      const items = focusableWithin(node);
      if (items.length === 0) {
        // Nowhere to go inside, so going anywhere means leaving.
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (!node || !node.contains(active)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, onClose]);

  // Hold the page still behind it.
  useEffect(() => {
    if (!isOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  const onBackdropClick = useCallback(
    (event) => {
      if (!closeOnBackdrop) return;
      // Only a press that both started and ended on the backdrop. Without
      // this, a drag that begins on text inside the dialog and releases
      // outside it closes the dialog and throws the selection away.
      if (event.target !== event.currentTarget) return;
      onClose?.();
    },
    [closeOnBackdrop, onClose]
  );

  return {
    dialogRef,
    dialogProps: {
      role,
      'aria-modal': true,
      ...(labelledBy ? { 'aria-labelledby': labelledBy } : {}),
      ...(label ? { 'aria-label': label } : {}),
    },
    backdropProps: {
      onClick: onBackdropClick,
    },
  };
}

export default useDialog;
