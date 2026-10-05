import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, CalendarClock, ChevronRight, GraduationCap, Hash, Users } from 'lucide-react';

import InfoChips from '../../../components/ui/InfoChips';
import SubjectLabel from '../../../components/ui/SubjectLabel';
import { useT } from '../../../i18n/LanguageContext';
import { sessionPhase } from '../../Course/teaching';
import { teachingDay } from '../teacherHome';

/*
  The teacher's meetings today on the dashboard (owner, 2026-10-05: today only, not
  the week). A day with none says so and names the next meeting still to come, which
  opens it. Which meetings, and which is next, is teachingDay's (teacherHome.js).

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

  const empty = (message, extra) => (
    <div className="py-8 px-4 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
      <CalendarClock className="w-7 h-7 text-slate-300 mb-2" aria-hidden="true" />
      <p className="text-xs font-semibold text-slate-600 max-w-xs leading-relaxed">{message}</p>
      {extra}
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
      <Link to="/teacher/courses" className="mt-1 text-xs font-bold text-brand hover:underline">
        {t('teacherDash.schedule.toCourses')}
      </Link>
    );
  } else if (day.meetings.length === 0) {
    const { next } = day;
    body = empty(
      t('teacherDash.schedule.noneToday'),
      next && (
        <Link
          to={meetingPath(next)}
          className="mt-3 inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 rounded-xl bg-brand-tint px-3 py-2 text-xs font-bold text-brand hover:bg-brand hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <span>{t('teacherDash.schedule.next')}:</span>
          <span className="font-extrabold">
            {dayLabel(next.local.date, locale, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              ...(today && next.local.date.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}),
            })}
            , {next.local.start}
          </span>
          <span>
            - {next.subject?.code ?? next.subject?.name} {next.class?.name}
          </span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
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
