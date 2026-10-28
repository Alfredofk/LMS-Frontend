import React from 'react';

import { useT } from '../../i18n/LanguageContext';

/*
  A year's semesters as one small segmented control, the Board's and the
  Timetable's (owner, 2026-10-28: the big purple buttons were too loud). As tall
  as the year's dropdown beside it, so the two labelled columns line up; the one
  chosen is pale purple, not filled.
*/
export const SemesterSegments = ({ id, semesters, value, onChange }) => {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-sm font-semibold text-slate-700 select-none">
        {t('subjects.board.semester')}
      </span>
      <div className="inline-flex self-start gap-1 rounded-xl border border-slate-200 bg-white p-1" role="group" aria-labelledby={id}>
        {semesters.map((entry) => {
          const on = entry.id === value;
          return (
            <button
              key={entry.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(entry.id)}
              className={`px-3.5 py-2 md:py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                on ? 'bg-brand-tint text-brand' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t('classes.semester.name', { n: entry.ordinal })}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SemesterSegments;
