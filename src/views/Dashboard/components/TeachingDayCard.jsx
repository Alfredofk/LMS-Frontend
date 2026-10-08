import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CalendarClock, CalendarX2, ChevronRight, GraduationCap, Hash, Users } from 'lucide-react';

import InfoChips from '../../../components/ui/InfoChips';
import SubjectLabel from '../../../components/ui/SubjectLabel';
import { useT } from '../../../i18n/LanguageContext';
import { meetingWhen } from '../../Classroom/myClasses';
import { sessionPhase } from '../../Course/teaching';
import { teachingDay } from '../teacherHome';

/*
  The teacher's meetings today on the dashboard (owner, 2026-10-05: today only, not
  the week). A day with none says so and names the next meeting still to come, which
  opens it. Which meetings, and which is next, is teachingDay's (teacherHome.js).
  The empty day looks as the student's today card does (owner, 2026-10-08): an
  icon on a brand tint, a bold line, and "Berikutnya: ..." as a small brand link.

  @param live      liveAssignments(...), null when the read failed, undefined while reading
  @param meetings  dayMeetings(...) - the teacher's meetings from today on
  @param today     the school's day, YYYY-MM-DD
*/

const PHASE_TONE = { running: 'emerald', awaiting: 'amber', confirmed: 'slate', cancelled: 'rose' };

/* Formatted in UTC so a calendar day never shifts. */
const dayLabel = (date, locale, options) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(locale, { ...options, timeZone: 'UTC' });

const meetingPath = (meeting) => `/teacher/courses/${meeting.classSubjectId}?pertemuan=${meeting.id}`;

const card = 'bg-white border border-slate-100 rounded-2xl p-5 shadow-sm text-left';

export const TeachingDayCard = ({ live, meetings, today, className = '' }) => {
  const { t, lang } = useT();
  const locale = lang === 'id' ? 'id-ID' : 'en-GB';
  const now = new Date();
  const loading = live === undefined;
  const failed = live === null;
  const day = live ? teachingDay(meetings, today, now) : null;

  /* As TodaySessionsCard's idle state: no dashed box. */
  const empty = (title, extra) => (
    <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
      <span className="w-14 h-14 bg-brand-tint text-brand rounded-2xl flex items-center justify-center mb-3">
        <CalendarX2 className="w-7 h-7" aria-hidden="true" />
      </span>
      <p className="text-sm font-extrabold text-slate-800 max-w-xs">{title}</p>
      {extra && <div className="mt-2 flex flex-col items-center gap-1">{extra}</div>}
    </div>
  );

  let body;
  if (loading) {
    body = (
      <div className="space-y-3 animate-pulse">
        {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100" />)}
      </div>
    );
  } else if (failed) {
    body = (
      <p className="flex items-center gap-2 text-xs font-extrabold text-rose-700" role="alert">
        <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
        {t('teacherDash.schedule.failed')}
      </p>
    );
  } else if (live.length === 0) {
    body = empty(
      t('teacherDash.schedule.noTeaching'),
      <Link to="/teacher/courses" className="text-[11px] font-bold text-brand hover:underline">
        {t('teacherDash.schedule.toCourses')}
      </Link>
    );
  } else if (day.meetings.length === 0) {
    const { next } = day;
    body = empty(
      t('teacherDash.schedule.noneToday'),
      next && (
        <Link to={meetingPath(next)} className="block text-center text-[11px] font-bold text-brand hover:underline">
          {t('teacherDash.schedule.nextLine', {
            subject: next.subject?.name ?? next.subject?.code ?? '',
            className: next.class?.name ?? '',
            when: meetingWhen(next, lang, { weekday: 'long' }),
          })}
        </Link>
      )
    );
  } else {
    body = (
      <ul className="divide-y divide-slate-100">
        {day.meetings.map((meeting) => {
          const phase = sessionPhase(meeting, now);
          return (
            <li key={meeting.id} className="py-1 first:pt-0 last:pb-0">
              <Link
                to={meetingPath(meeting)}
                className="flex items-start gap-3 rounded-xl px-2 py-2.5 -mx-2 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="w-14 shrink-0 tabular-nums">
                  <span className="block text-xs font-extrabold text-slate-800">{meeting.local.start}</span>
                  <span className="block text-[11px] font-semibold text-slate-500">{meeting.local.end}</span>
                </span>
                <span className="w-px self-stretch bg-slate-100 shrink-0" aria-hidden="true" />
                <span className={`min-w-0 flex-1 ${phase === 'cancelled' ? 'opacity-70' : ''}`}>
                  <span className={`block text-sm font-extrabold text-slate-900 leading-tight break-words ${phase === 'cancelled' ? 'line-through' : ''}`}>
                    <SubjectLabel code={meeting.subject?.code} name={meeting.subject?.name} />
                  </span>
                  {/* Coloured pills kept (owner, 2026-10-07: plain grey read too bare here). */}
                  <InfoChips
                    size="xs"
                    className="mt-2"
                    items={[
                      PHASE_TONE[phase] && { label: t(`teach.phase.${phase}`), tone: PHASE_TONE[phase] },
                      meeting.class?.name && { icon: Users, label: meeting.class.name, tone: 'brand' },
                      meeting.class?.gradeLevel && {
                        icon: GraduationCap,
                        label: t('teacherDash.schedule.grade', { grade: meeting.class.gradeLevel }),
                      },
                      meeting.number && { icon: Hash, label: t('meeting.tab', { n: meeting.number }) },
                    ]}
                  />
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 self-center" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section className={`${card} flex flex-col ${className}`} aria-labelledby="teacher-schedule-heading" aria-busy={loading}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-brand-tint text-brand flex items-center justify-center shrink-0">
            <CalendarClock className="w-4.5 h-4.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="teacher-schedule-heading" className="text-base font-extrabold text-slate-800 tracking-tight">
              {t('teacherDash.schedule.title')}
            </h2>
            {today && (
              <p className="text-[11px] font-semibold text-slate-500">
                {dayLabel(today, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>
        <Link to="/schedule" className="shrink-0 text-xs font-semibold text-brand hover:underline">
          {t('common.seeAll')}
        </Link>
      </div>
      {body}
    </section>
  );
};

export default TeachingDayCard;
