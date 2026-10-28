import React, { useState } from 'react';
import { AlertCircle, ChevronRight, Info, X } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';

/*
  Every class a tone needs, written out whole so Tailwind finds them and
  `npm run theme:dark` gives each a dark rule. Error is rose, as everywhere else
  a failure is shown; it was red before the owner's design of 2026-10-27.
*/
const TONES = {
  success: {
    card: 'border-emerald-100 shadow-emerald-600/15',
    wash: 'bg-emerald-50',
    icon: 'bg-emerald-600',
    halo: 'rgb(5 150 105 / 0.16)',
    action: 'border-emerald-600/20 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    line: 'bg-emerald-600',
    track: 'bg-emerald-600/10',
  },
  error: {
    card: 'border-rose-100 shadow-rose-600/15',
    wash: 'bg-rose-50',
    icon: 'bg-rose-600',
    halo: 'rgb(225 29 72 / 0.16)',
    action: 'border-rose-600/20 bg-rose-50 text-rose-700 hover:bg-rose-100',
    line: 'bg-rose-600',
    track: 'bg-rose-600/10',
  },
  info: {
    card: 'border-brand/20 shadow-brand/15',
    wash: 'bg-brand-tint',
    icon: 'bg-brand',
    halo: 'rgb(112 71 235 / 0.16)',
    action: 'border-brand/20 bg-brand-tint text-brand hover:bg-brand/15',
    line: 'bg-brand',
    track: 'bg-brand/10',
  },
};

/* A failure stays longer: it usually asks the reader to do something. */
const DEFAULT_MS = { success: 4500, info: 4500, error: 7000 };

/**
 * The app's one toast, bottom right (owner, 2026-10-27; the skill
 * `.claude/skills/eduforid-design` keeps the approved design).
 *
 * `message` arrives already translated — every caller runs it through `t()`
 * before handing it over. It is the toast's title. `description` (one grey
 * line) and `action` ({ label, onClick }) are optional and also translated by
 * the caller; "Baru saja" and the close button's label belong to this file.
 *
 * The line along the foot is the clock: the toast closes when it runs out, so
 * hovering or focusing the toast pauses the closing too. Closing plays the exit
 * animation first and calls `onClose` when it ends.
 */
export const Toast = ({ message, ...rest }) => {
  if (!message) return null;
  /* Keyed by the message, so a new toast that replaces an open one starts over. */
  return <ToastCard key={message} message={message} {...rest} />;
};

const ToastCard = ({
  message,
  description,
  action,
  type = 'info', // 'success' | 'error' | 'info'
  duration,
  onClose,
}) => {
  const { t } = useT();
  const [leaving, setLeaving] = useState(false);
  const tone = TONES[type] ?? TONES.info;
  const ms = duration ?? DEFAULT_MS[type] ?? DEFAULT_MS.info;

  const leave = () => setLeaving(true);
  /* Only the card's own exit counts: the icon's halo and check end inside it too. */
  const onCardAnimationEnd = (e) => {
    if (leaving && e.target === e.currentTarget) onClose();
  };

  return (
    <div className="fixed z-50 bottom-5 right-5 w-[min(384px,calc(100vw-32px))] max-sm:inset-x-4 max-sm:bottom-4 max-sm:w-auto">
      <div
        role={type === 'error' ? 'alert' : 'status'}
        aria-live={type === 'error' ? 'assertive' : 'polite'}
        style={{ '--toast-ms': `${ms}ms`, '--halo': tone.halo }}
        onAnimationEnd={onCardAnimationEnd}
        className={`group relative overflow-hidden flex items-start gap-3 rounded-[18px] bg-white border shadow-lg pl-3.5 pr-2.5 pt-3.5 pb-4 ${tone.card} ${
          leaving ? 'animate-toast-out' : 'animate-toast-in'
        }`}
      >
        {/* The wash of the tone from the left: a masked pale layer rather than a
            gradient, because dark.css flips `bg-*-50` but not gradient stops. */}
        <span
          aria-hidden="true"
          className={`absolute inset-0 ${tone.wash} [mask-image:linear-gradient(100deg,#000,transparent_55%)]`}
        />

        <span className={`relative grid place-items-center w-9 h-9 rounded-full text-white shrink-0 animate-halo ${tone.icon}`}>
          {type === 'success' ? (
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path className="animate-draw" d="M20 6L9 17l-5-5" />
            </svg>
          ) : type === 'error' ? (
            <AlertCircle className="w-[18px] h-[18px]" strokeWidth={2.5} aria-hidden="true" />
          ) : (
            <Info className="w-[18px] h-[18px]" strokeWidth={2.5} aria-hidden="true" />
          )}
        </span>

        <div className="relative flex-1 min-w-0 pt-px">
          <div className="flex items-baseline gap-2">
            <p className="text-[13.5px] font-extrabold text-slate-900 leading-snug">{message}</p>
            <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">{t('shell.time.justNow')}</span>
          </div>
          {description && <p className="mt-0.5 text-[12.5px] text-slate-500 leading-snug">{description}</p>}
          {action && (
            <button
              type="button"
              onClick={() => {
                action.onClick?.();
                leave();
              }}
              className={`mt-2.5 inline-flex items-center gap-1 rounded-[10px] border px-3 py-1 text-xs font-bold transition-colors active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${tone.action}`}
            >
              {action.label}
              <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={leave}
          className="relative -mt-1 p-1.5 rounded-[10px] text-slate-500 hover:text-slate-700 hover:bg-slate-900/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-label={t('common.dismiss')}
        >
          <X className="w-[15px] h-[15px]" aria-hidden="true" />
        </button>

        <span aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-1 ${tone.track}`} />
        <span
          aria-hidden="true"
          onAnimationEnd={(e) => {
            e.stopPropagation();
            leave();
          }}
          className={`animate-toast-time absolute inset-x-0 bottom-0 h-1 rounded-r-full ${tone.line}`}
        />
      </div>
    </div>
  );
};

export default Toast;
