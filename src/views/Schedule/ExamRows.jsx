import React from 'react';
import { useNavigate } from 'react-router-dom';

import { useT } from '../../i18n/LanguageContext';
import { pathOf, wordOf } from '../StudentAssessment/studentMenu';
import { typeModeText } from '../TeacherAssessment/teacherAssessment';

/*
  A student's UTS and UAS of one day (owner 2026-10-18), as `examsByDay` gives
  them: the times on that day, the subject, "UTS daring", the title, where the
  student stands, and "Buka ujian". On the lesson calendar's days and on the
  dashboard's today card, so the two read the same. Rendered as <li>s, for the
  list around them.

  A teacher's entry (`teacherExamClasses`, it carries `row`) names the class
  instead of a standing, and opens the assessment's own page.
*/
export const ExamRows = ({ rows }) => {
  const { t } = useT();
  const navigate = useNavigate();
  return (rows ?? []).map(({ entry, from, to }) => {
    const staff = Boolean(entry.row);
    const word = staff ? null : wordOf(entry);
    const status = staff
      ? null
      : word
        ? t(`smenu.status.${word}`)
        : entry.status === 'RELEASED'
          ? t('lessons.exam.released')
          : t('lessons.exam.upcoming');
    const path = staff ? `/teacher/courses/${entry.row.id}/penilaian/${entry.assessment.id}` : pathOf(entry);
    return (
      <li key={`x-${entry.assessment.id}`} className="rounded-xl border border-slate-100 px-3 py-2.5 flex items-start gap-3">
        <span className="w-12 shrink-0 tabular-nums">
          <span className="block text-xs font-extrabold text-slate-800">{from}</span>
          <span className="block text-[11px] font-semibold text-slate-500">{to}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-extrabold text-slate-800 break-words">{entry.assessment.classSubject?.subject?.name}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-700 font-extrabold">{typeModeText(t, entry.assessment)}</span>
            {staff && entry.row.class?.name && (
              <span className="px-1.5 py-0.5 rounded-md bg-brand-tint text-brand font-extrabold">{entry.row.class.name}</span>
            )}
          </span>
          <span className="block text-[11px] font-semibold mt-1 text-slate-500 break-words">{entry.assessment.title}</span>
          {status && <span className="block text-[11px] font-semibold mt-0.5 text-slate-500">{status}</span>}
          <button
            type="button"
            onClick={() => navigate(path)}
            className="mt-2 flex w-fit items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand-tint text-brand text-[11px] font-extrabold hover:bg-brand hover:text-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {t(staff ? 'lessons.exam.openStaff' : 'lessons.exam.open')}
          </button>
        </span>
      </li>
    );
  });
};

export default ExamRows;
