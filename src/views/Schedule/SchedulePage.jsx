import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { ROLES, isPrincipalDesk } from '../../constants/roles';
import NotBuiltYet from '../../components/ui/NotBuiltYet';
import FactLine from '../../components/ui/FactLine';
import Button from '../../components/ui/Button';
import { academicsService } from '../../services/academicsService';
import { readMyTeaching } from '../Course/readMyTeaching';
import { splitTeaching, teachingSemesters } from '../Course/teaching';
import { openSemesterIds } from '../Dashboard/teacherHome';
import { defaultSemesterId } from '../Classroom/myClasses';
import HolidayCalendar from './HolidayCalendar';
import StudentLessonCalendar from './StudentLessonCalendar';

/*
  /schedule: the school's holiday calendar, then the reader's lessons.

  - Holidays are real for everybody (backend 9dee2e2); the Principal and a Vice
    Principal keep them (ticket 19).
  - A student gets one month of lessons and holidays together instead of both
    calendars (StudentLessonCalendar; owner 2026-10-03, after BINUSMAYA).
  - The Principal and a Vice Principal set and read every class's week on the
    Subjects page's Timetable tab, so this page points there rather than
    drawing a second copy.
  - A teacher gets the student's page with their own meetings (`?mine=true` and
    each assignment's sessions, teacherLessons.js; owner 2026-10-03). Only the
    Principal's desk adds holidays.

  This page used to ask `/api/schedule/:role`, which never existed, and carry a
  month grid and agenda drawn for its guessed shape. Both went (owner,
  2026-10-03).

  Since 2026-10-28 (the mockup the owner reviewed) a slash line under the title:
  a student's school / class / year (from /users/me, nothing read); a teacher's
  school / the semester on / the subjects in it (readMyTeaching, kept a minute and
  shared with "Kelas Saya", plus the years); the leaders' school / the year shown /
  its school holidays (HolidayCalendar's `onSummary`).
*/

/* A teacher's semester on now and how many subjects they teach in it; null until read. */
function useTeachingNow(active, membershipId) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    Promise.all([readMyTeaching(membershipId), academicsService.academicYears()])
      .then(([answer, years]) => {
        if (cancelled) return;
        const open = openSemesterIds(years);
        const groups = splitTeaching(answer.rows, open);
        const id = defaultSemesterId(groups.live, answer.sessionsById);
        const semester = teachingSemesters(groups.taught, open).find((entry) => entry.id === id) ?? null;
        setNow({ semester, count: groups.taught.filter((row) => row.semester?.id === id).length });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active, membershipId]);
  return now;
}
export const SchedulePage = () => {
  const { activeRole, membership } = useAuth();
  const outlet = useOutletContext();
  const navigate = useNavigate();
  const { t } = useT();
  const role = activeRole || ROLES.STUDENT;
  const leads = isPrincipalDesk(role);
  const teaching = useTeachingNow(role === ROLES.TEACHER, membership?.id);
  /* The leaders' year and its school holidays, from the calendar below. */
  const [summary, setSummary] = useState(null);
  const school = membership?.school?.name ?? membership?.schoolName;
  const studentClass = membership?.student?.class ?? null;
  const facts =
    role === ROLES.STUDENT
      ? [school, studentClass?.name, studentClass?.academicYear]
      : role === ROLES.TEACHER
        ? [
            school,
            teaching?.semester && t('teacherDash.academicContext', { year: teaching.semester.academicYear, n: teaching.semester.ordinal }),
            teaching && t('subjects.subtitle.taught', { n: teaching.count }),
          ]
        : [school, summary && String(summary.year), summary && t('schedule.schoolHolidays', { n: summary.school })];
  const heading = (key) => (
    <div>
      <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">{t(key)}</h1>
      <FactLine className="mt-2" facts={facts} />
    </div>
  );

  /* A teacher gets the student's page with their own meetings, and neither adds
     holidays (owner, 2026-10-03). */
  if (role === ROLES.STUDENT || role === ROLES.TEACHER) {
    return (
      <div className="space-y-6">
        {heading('shell.schedule')}
        <StudentLessonCalendar teacher={role === ROLES.TEACHER} />
      </div>
    );
  }

  let lessons;
  if (leads) {
    lessons = (
      /* No pastel icon tile, an ordinary outline button (the reviewed mockup, owner 2026-10-28). */
      <div className="bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="flex-1 min-w-0 text-[13px] text-slate-600 leading-relaxed">{t('schedule.leads.body')}</p>
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => navigate('/headmaster/subjects', { state: { tab: 'SCHEDULE' } })}>
          {t('schedule.leads.action')}
          <ArrowRight className="w-3.5 h-3.5 ml-1" aria-hidden="true" />
        </Button>
      </div>
    );
  } else {
    lessons = <NotBuiltYet />;
  }

  return (
    <div className="space-y-6">
      {heading(leads ? 'shell.calendar' : 'shell.schedule')}
      <HolidayCalendar canManage={leads} showToast={outlet?.showToast} onSummary={setSummary} />
      <section className="space-y-3">
        <h2 className="text-base font-extrabold text-slate-900">{t('holiday.lessons')}</h2>
        {lessons}
      </section>
    </div>
  );
};

export default SchedulePage;
