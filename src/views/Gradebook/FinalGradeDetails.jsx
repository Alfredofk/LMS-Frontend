import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { formatNumber } from '../TeacherAssessment/results';
import { GRADE_TYPES, finalNotes } from './gradebook';

/*
  A student's final grade, taken apart (owner, 2026-10-18): a small popover by
  the cell, not a dialog, so it works inside the readers' dialogs too. Each
  type's average with the weight it carries once the types with nothing that
  counts drop out (the backend's, from the grade read), the number before
  rounding, and every count above 0 (finalNotes). Portalled into <body> and
  placed `fixed` by the anchor: the table's scroll box would clip it. Below the
  cell, else above it, else as low as it fits whole. It closes on a click
  outside, Escape (focus back to the cell), a scroll of the page or a resize.

  @param anchor   the cell's button, to place it by and give focus back to
  @param final    the row's `final` (finalOf), with a grade
  @param name     the student's name, under the title
  @param rule     the remedial rule the grade read names, for its note
  @param onClose  () => void
*/

const WIDTH = 288;
const GAP = 6;
const EDGE = 8;

const fixed2 = (value, lang) =>
  new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));

export const FinalGradeDetails = ({ anchor, final, name, rule, onClose }) => {
  const { t, lang } = useT();
  const box = useRef(null);

  /* Under the cell, its right edge on the cell's; above it when there is no room
     below. Written on the node before paint: it needs its own height first. */
  useLayoutEffect(() => {
    const node = box.current;
    if (!node) return;
    const at = anchor.getBoundingClientRect();
    const height = node.offsetHeight;
    const below = at.bottom + GAP;
    const above = at.top - GAP - height;
    /* Room on neither side (a short window): as low as it fits whole, over the cell if it must. */
    const top = below + height <= window.innerHeight - EDGE ? below : above >= EDGE ? above : Math.max(EDGE, window.innerHeight - height - EDGE);
    node.style.left = `${Math.max(EDGE, Math.min(at.right - WIDTH, window.innerWidth - WIDTH - EDGE))}px`;
    node.style.top = `${top}px`;
    node.style.visibility = 'visible';
  }, [anchor]);

  useEffect(() => {
    box.current?.focus();
    /* Its own scrolling (a short window) is not a reason to close. */
    const close = (event) => {
      if (!(event.target instanceof Node && box.current?.contains(event.target))) onClose();
    };
    const outside = (event) => {
      if (!box.current?.contains(event.target) && !anchor.contains(event.target)) onClose();
    };
    const escape = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
      anchor.focus();
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape, true);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [anchor, onClose]);

  const ruleName = rule ? t(`grading.rule.${rule}`) : '-';

  return createPortal(
    <div
      ref={box}
      role="dialog"
      aria-label={t('gradebook.final.title')}
      tabIndex={-1}
      style={{ width: WIDTH, maxHeight: `calc(100vh - ${2 * EDGE}px)`, left: 0, top: 0, visibility: 'hidden' }}
      className="fixed z-[70] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl p-4 space-y-3 focus:outline-none"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-slate-900">{t('gradebook.final.title')}</p>
          <p className="text-xs font-semibold text-slate-500 break-words">{name}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            onClose();
            anchor.focus();
          }}
          aria-label={t('common.close')}
          className="p-1 -m-1 rounded-lg text-slate-500 hover:text-slate-700 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-xs">
        {GRADE_TYPES.map((type) => {
          const part = final.types?.[type] ?? null;
          return (
            <React.Fragment key={type}>
              <dt className="font-bold text-slate-700">{t(`tasm.type.${type}`)}</dt>
              {part ? (
                <dd className="flex flex-wrap items-baseline gap-x-2.5 font-semibold text-slate-500">
                  <span className="text-sm font-extrabold tabular-nums text-slate-900">{formatNumber(part.average, lang)}</span>
                  <span className="tabular-nums">{t('gradebook.final.weight', { weight: formatNumber(part.weight, lang) })}</span>
                  <span className="tabular-nums">{t('gradebook.final.count', { n: part.count })}</span>
                </dd>
              ) : (
                <dd className="font-semibold text-slate-500">
                  <span className="text-sm font-extrabold text-slate-900">-</span> {t('gradebook.final.noneYet')}
                </dd>
              )}
            </React.Fragment>
          );
        })}
      </dl>

      <p className="text-xs font-semibold text-slate-600 tabular-nums">
        {final.unrounded === null ? t('gradebook.final.empty') : t('gradebook.final.unrounded', { value: fixed2(final.unrounded, lang) })}
      </p>

      {finalNotes(final).length > 0 && (
        <ul className="space-y-1 border-t border-slate-100 pt-2.5">
          {finalNotes(final).map(({ key, n }) => (
            <li key={key} className={`text-[11px] font-semibold leading-relaxed ${key === 'didNotSubmit' ? 'text-rose-700' : key === 'waiting' ? 'text-amber-700' : 'text-slate-500'}`}>
              {t(`gradebook.final.note.${key}`, { n, rule: ruleName })}
            </li>
          ))}
        </ul>
      )}
    </div>,
    document.body
  );
};

export default FinalGradeDetails;
