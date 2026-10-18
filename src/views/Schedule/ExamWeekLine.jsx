import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { formatDay } from '../Classes/format';

/*
  The dashboards' Exam Week reminder (owner 2026-10-18): one line, as the
  teacher's "being finalised" line is, leading to /schedule. `reminder` is
  useMyExamWeek's answer; nothing is drawn without one.

  `staff` (the teacher's dashboard): a teacher may teach grades the week leaves
  alone, so the line names the grades of theirs it holds (`shownGrades`) and does
  not say that no meeting is held.
*/
export const ExamWeekLine = ({ reminder, staff = false }) => {
  const { t, lang } = useT();
  const navigate = useNavigate();
  if (!reminder) return null;
  const { week } = reminder;
  const vars = {
    type: week.type,
    name: week.name,
    start: formatDay(week.start, lang),
    end: formatDay(week.end, lang),
    n: reminder.days,
    grades: (week.shownGrades ?? week.gradeLevels ?? []).join(', '),
  };
  const key = `exam.remind.${reminder.kind}${staff ? 'Staff' : ''}`;
  return (
    <button
      type="button"
      onClick={() => navigate('/schedule')}
      className="w-full flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:border-brand cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <span>{t(key, vars)}</span>
      <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
    </button>
  );
};

export default ExamWeekLine;
