import React from 'react';

const fieldLabel = 'block text-sm font-bold text-slate-700';
const errorText = 'text-xs font-semibold text-red-600';
const smallInput =
  'block w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50 disabled:text-slate-500';

/*
  A copy's window (backend copyBody: a new window as both ends, or none). When
  every target sits in the source's semester the teacher may keep the source's
  window; once one does not, a new one is required (owner, 2026-10-08: the
  fields start empty, the source's window said as a hint).

  @param required    a target lies in another semester
  @param keep        true: the source's window; false: a new one
  @param onKeep      (boolean) => void
  @param value       `{ opensDate, opensTime, closesDate, closesTime }`
  @param onChange    (key, value) => void
  @param errors      `{ opens?, closes? }` keys
  @param sourceText  the source's window in words
  @param bounds      `{ min, max }` days for the date boxes, when one semester holds them all
  @param zone        the school's zone, said in the labels
  @param requiredKey what to say when a new window is required
*/
export const WindowChoice = ({ required, keep, onKeep, value, onChange, errors = {}, sourceText, bounds = null, zone, disabled = false, requiredKey = 'tasm.copy.windowRequired', t }) => {
  const tz = zone ? ` (${zone})` : '';
  const showFields = required || !keep;
  return (
    <fieldset className="space-y-3">
      <legend className={fieldLabel}>{t('tasm.copy.window')}</legend>
      {required ? (
        <p className="text-[11px] font-medium text-slate-500 leading-relaxed">{t(requiredKey, { window: sourceText })}</p>
      ) : (
        <div className="space-y-2">
          {[true, false].map((option) => (
            <label key={String(option)} className="flex items-start gap-2.5 cursor-pointer select-none">
              <input type="radio" checked={keep === option} disabled={disabled} onChange={() => onKeep(option)} className="mt-0.5 w-4 h-4 accent-brand cursor-pointer" />
              <span className="text-sm font-semibold text-slate-700">
                {option ? t('tasm.copy.keepWindow', { window: sourceText }) : t('tasm.copy.newWindow')}
              </span>
            </label>
          ))}
        </div>
      )}
      {showFields && (
        <div className="space-y-3">
          {[
            ['opens', 'opensDate', 'opensTime'],
            ['closes', 'closesDate', 'closesTime'],
          ].map(([end, dateKey, timeKey]) => (
            <div key={end} className="space-y-1.5">
              <span className="block text-xs font-bold text-slate-600">{t(`tasm.field.${end}`) + tz}</span>
              <div className="grid grid-cols-[1fr_auto] gap-2 max-w-sm">
                <input
                  type="date"
                  aria-label={t(`tasm.field.${end}Date`)}
                  value={value[dateKey]}
                  min={bounds?.min}
                  max={bounds?.max}
                  disabled={disabled}
                  aria-invalid={Boolean(errors[end])}
                  onChange={(e) => onChange(dateKey, e.target.value)}
                  className={smallInput}
                />
                <input
                  type="time"
                  aria-label={t(`tasm.field.${end}Time`)}
                  value={value[timeKey]}
                  disabled={disabled}
                  aria-invalid={Boolean(errors[end])}
                  onChange={(e) => onChange(timeKey, e.target.value)}
                  className={`${smallInput} w-32`}
                />
              </div>
              {errors[end] && <p className={errorText}>{t(errors[end])}</p>}
            </div>
          ))}
        </div>
      )}
    </fieldset>
  );
};

export default WindowChoice;
