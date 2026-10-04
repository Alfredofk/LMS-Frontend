/*
  Class names for the buttons every dialog shares; ModalHeading.jsx explains why
  (owner, 2026-10-03: one look for every confirmation, with room around the buttons).
*/

/** The row the buttons sit in: stacked full width on a phone, cancel last; side by side from 640px. */
export const modalActions = 'flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3';

const buttonBase =
  'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2';

/** The way out: outlined, never the colour of the action. */
export const modalCancelClass = (busy = false) =>
  `${buttonBase} text-slate-700 bg-white border border-slate-200 focus-visible:ring-slate-400 ${
    busy ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 cursor-pointer'
  }`;

const CONFIRM_TONE = {
  danger: 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500 shadow-rose-600/20',
  brand: 'bg-brand hover:bg-brand-deep focus-visible:ring-brand shadow-brand/30',
};

/** The action: filled, red when it destroys something, purple otherwise. */
export const modalConfirmClass = (tone = 'brand', busy = false) =>
  `${buttonBase} px-6 text-white shadow-md focus-visible:ring-offset-2 ${CONFIRM_TONE[tone] ?? CONFIRM_TONE.brand} ${
    busy ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
  }`;
