import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ArrowRight, CalendarRange } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { ROLES, isPrincipalDesk } from '../../constants/roles';
import NotBuiltYet from '../../components/ui/NotBuiltYet';
import HolidayCalendar from './HolidayCalendar';
import StudentLessonCalendar from './StudentLessonCalendar';

/*
  /schedule: the school's holiday calendar, then the reader's lessons.

  - Holidays are real for everybody (backend 9dee2e2); the Principal and a Vice
    Principal keep them (ticket 19).
  - A student's lessons are real since backend 2a281e7 — StudentLessonCalendar.
  - The Principal and a Vice Principal set and read every class's week on the
    Subjects page's Timetable tab, so this page points there rather than
    drawing a second copy.
  - A teacher's lessons are the teammate's to build (`?mine=true`); until then
    they read "not available yet".

  This page used to ask `/api/schedule/:role`, which never existed, and carry a
  month grid and agenda drawn for its guessed shape. Both went (owner,
  2026-10-03).
*/
export const SchedulePage = () => {
  const { activeRole } = useAuth();
  const outlet = useOutletContext();
  const navigate = useNavigate();
  const { t } = useT();
  const role = activeRole || ROLES.STUDENT;
  const leads = isPrincipalDesk(role);

  let lessons;
  if (role === ROLES.STUDENT) {
    lessons = <StudentLessonCalendar />;
  } else if (leads) {
    lessons = (
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
        <span className="w-12 h-12 bg-brand-tint text-brand rounded-2xl flex items-center justify-center shrink-0">
          <CalendarRange className="w-6 h-6" aria-hidden="true" />
        </span>
        <p className="flex-1 min-w-0 text-xs font-semibold text-slate-600 leading-relaxed">{t('schedule.leads.body')}</p>
        <button
          type="button"
          onClick={() => navigate('/headmaster/subjects', { state: { tab: 'SCHEDULE' } })}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-extrabold text-brand bg-brand-tint hover:bg-brand hover:text-white rounded-xl transition-all cursor-pointer"
        >
          {t('schedule.leads.action')}
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    );
  } else {
    lessons = <NotBuiltYet />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('shell.schedule')}</h1>
      <HolidayCalendar canManage={leads} showToast={outlet?.showToast} />
      <section className="space-y-3">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('holiday.lessons')}</h2>
        {lessons}
      </section>
    </div>
  );
};

export default SchedulePage;
