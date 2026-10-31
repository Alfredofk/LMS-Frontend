import React from 'react';
import { AlertTriangle, CircleAlert, HelpCircle, Trash2 } from 'lucide-react';

/*
  The parts every dialog in the app shares (owner, 2026-10-03: "modalnya usahain
  di buat 1 style" — one look for every confirmation, in the app's own colours).

  The dialogs keep their own state, focus and Escape handling; what they share is
  how they look: an icon tile beside the title, the same button row, and the
  same two buttons with room around them ("terlalu dempet" — the old row was
  8px apart with 8px-tall padding).
*/

const TONE = {
  danger: { tile: 'bg-rose-50 text-rose-600', icon: Trash2 },
  warning: { tile: 'bg-amber-50 text-amber-600', icon: AlertTriangle },
  brand: { tile: 'bg-brand-tint text-brand', icon: HelpCircle },
};

/** The icon tile, title and description at the top of a dialog. */
export const ModalHeading = ({ tone = 'brand', icon, titleId, title, bodyId, body }) => {
  const style = TONE[tone] ?? TONE.brand;
  const Icon = icon ?? style.icon;
  return (
    <div className="flex items-start gap-4">
      <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${style.tile}`}>
        <Icon className="w-5 h-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
        <h2 id={titleId} className="text-base font-extrabold text-slate-900 tracking-tight break-words">
          {title}
        </h2>
        {body && (
          <div id={bodyId} className="text-xs text-slate-500 font-medium leading-relaxed">
            {body}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModalHeading;

/** A dialog's error (mockup akses-dialog.html, owner 2026-10-30): a rose box with its icon, in place of red text or a red bar. */
export const ModalError = ({ id, children }) => (
  <p id={id} className="flex items-start gap-2.5 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-[13px] font-semibold leading-relaxed text-rose-700" role="alert">
    <CircleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
    <span className="min-w-0 break-words">{children}</span>
  </p>
);

/**
 * What a confirm button says while it runs: a small spinner beside its own label,
 * never "Memuat...". The spinner takes the button's text colour and brings its own
 * gap, so it reads on a filled button and an outlined one alike.
 */
export const BusyLabel = ({ busy, children }) => (
  <span className="inline-flex items-center justify-center gap-2">
    {busy && <span className="w-4 h-4 shrink-0 rounded-full border-2 border-current border-r-transparent animate-spin motion-reduce:animate-none" aria-hidden="true" />}
    {children}
  </span>
);
