import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import ModalHeading from './ModalHeading';
import { modalActions, modalCancelClass, modalConfirmClass } from './modalStyles';

/*
  A question that has to be answered before something irreversible happens.

  The first dialog in this app with any accessibility at all. There are eight
  modals in `src/views/` and not one of them sets `role`, `aria-modal`,
  `aria-labelledby`, handles Escape, traps focus or restores it — plus five
  `window.confirm()` calls carrying hardcoded Indonesian that never reaches the
  dictionaries. This is meant to be what replaces them, one screen at a time.

  ## Why a portal, when nothing else in this app uses one

  The sidebar that opens this is inside an `<aside>`, and a dialog that lives in
  an arbitrary parent should not depend on that parent's `overflow`, `transform`
  or `contain`. `position: fixed` escapes overflow clipping *today*, because no
  ancestor happens to create a containing block — a guarantee any future CSS
  change could break silently, in a component nobody would think to re-test.

  ## Why the cancel button takes focus

  This dialog exists because somebody clicked something they may not have meant
  to. Putting focus on the destructive button would mean a reflexive Enter
  confirms it, which is the same accident one step later.
*/

/**
 * @param {boolean} open
 * @param {string} title        already translated
 * @param {string} body         already translated
 * @param {string} confirmLabel already translated
 * @param {string} cancelLabel  already translated
 * @param {'danger'|'brand'} [tone]  red with a bin, or purple with a question mark
 * @param {import('react').ComponentType} [icon]  another lucide icon for the tile
 * @param {boolean} [busy]        the confirmed work is still running: both
 *                                buttons, Escape and the backdrop stop answering,
 *                                so the question cannot be answered twice
 * @param {string} [busyLabel]    already translated; falls back to confirmLabel
 * @param {() => void} onConfirm
 * @param {() => void} onCancel  also called by Escape and by a backdrop click
 */
export const ConfirmDialog = ({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  icon,
  busy = false,
  busyLabel,
  onConfirm,
  onCancel,
}) => {
  const cancelRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    // Remember who opened this, so closing can hand focus back.
    openerRef.current = document.activeElement;
    cancelRef.current?.focus();

    const onKeyDown = (e) => {
      // Escape is a way to answer "no". While the "yes" is still running there
      // is no longer a question to answer.
      if (busy) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      /*
        Only if the opener is still on the page. Confirming a log-out unmounts
        the whole layout, so by the time this runs the button that opened it may
        be gone — focusing a detached node throws nothing but achieves nothing.
      */
      if (openerRef.current?.isConnected) openerRef.current.focus();
    };
  }, [open, onCancel, busy]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={busy ? undefined : onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-body"
        aria-busy={busy}
        /* The backdrop closes on click; the panel must not pass its own clicks up. */
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 sm:p-7 space-y-4 text-left max-h-[90dvh] overflow-y-auto"
      >
        <ModalHeading
          tone={tone === 'brand' ? 'brand' : 'danger'}
          icon={icon}
          titleId="confirm-dialog-title"
          title={title}
          bodyId="confirm-dialog-body"
          body={body}
        />

        <div className={modalActions}>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            /*
              The disabled state is spelled out rather than left to Tailwind's
              `disabled:` variant. Utilities share one layer at equal specificity
              and a tie goes to stylesheet order, so `disabled:cursor-not-allowed`
              beating `cursor-pointer` would be luck. Only one of the two is
              emitted, which needs no luck.
            */
            className={modalCancelClass(busy)}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={modalConfirmClass(tone === 'brand' ? 'brand' : 'danger', busy)}
          >
            {busy ? busyLabel ?? confirmLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmDialog;
