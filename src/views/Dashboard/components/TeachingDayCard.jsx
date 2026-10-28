import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, CalendarX2, Check, ChevronRight, Clock, Users } from 'lucide-react';

import { useT } from '../../../i18n/LanguageContext';
import Button from '../../../components/ui/Button';
import { meetingWhen } from '../../Classroom/myClasses';
import { sessionPhase } from '../../Course/teaching';
import { teachingDay } from '../teacherHome';
import { withoutExamWeekCancelled } from '../../Schedule/lessonCalendar';
import ExamRows from '../../Schedule/ExamRows';
import { Bone, HomeCard, HomeEmpty, HomeError } from './HomeCard';

/*
  The teacher's meetings today on the dashboard (owner, 2026-10-05: today only, not
  the week). Which meetings, and which is next, is teachingDay's (teacherHome.js).

  The look since 2026-10-27 (the approved teacher mockup; the skill
  `.claude/skills/eduforid-design`), as the student's "today": one meeting large -
  the one running, else the first begun and not confirmed, else the next to start -
  with one main action, "Konfirmasi kehadiran", which opens that meeting on its
  attendance part (`?bagian=kehadiran`), and "Materi" beside it. The other meetings
  of the day are a short list under it. GET /sessions/teaching says only whether a
  meeting is confirmed, so no check-in count is shown. A day with none says so and
  names the next meeting still to come.

  @param live      liveAssignments(...), null when the read failed, undefined while reading
  @param meetings  dayMeetings(...) - the teacher's meetings from today on
  @param today     the school's day, YYYY-MM-DD
  @param examWeek  the Exam Week running today for a grade taught (owner 2026-10-18), or
                   null: its cancelled meetings are left out, and an empty day says why
  @param exams     that day's published UTS and UAS of the subjects taught (examsByDay over
                   teacherExamClasses), shown above the meetings
*/

/* Formatted in UTC so a calendar day never shifts. */
const dayLabel = (date, locale, options) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(locale, { ...options, timeZone: 'UTC' });

const meetingPath = (meeting, part = null) =>
  `/teacher/courses/${meeting.classSubjectId}?pertemuan=${meeting.id}${part ? `&bagian=${part}` : ''}`;

/* The meeting laid out large: running, else begun and unconfirmed, else the next to start. */
const FOCUS_ORDER = ['running', 'awaiting', 'upcoming'];

/* The word under a meeting of the short list, and its colour. */
const PHASE_TEXT = {
  running: 'text-emerald-700',
  awaiting: 'text-amber-700',
  confirmed: 'text-emerald-700',
  upcoming: 'text-slate-500',
  cancelled: 'text-rose-700',
};

export const TeachingDayCard = ({ live, meetings, today, examWeek = null, exams = null, className = '' }) => {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const locale = lang === 'id' ? 'id-ID' : 'en-GB';
  const now = new Date();
  const loading = live === undefined;
  const failed = live === null;
  const day = live ? teachingDay(examWeek ? withoutExamWeekCancelled(meetings) : meetings, today, now) : null;
  const todayExams = live ? exams ?? [] : [];

  const card = (body) => (
    <HomeCard id="teacher-schedule-heading" title={t('teacherDash.schedule.title')} linkLabel={t('dash.today.schedule')} linkTo="/schedule" className={className}>
      {today && <p className="-mt-3 mb-4 text-xs text-slate-500">{dayLabel(today, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>}
      {todayExams.length > 0 && (
        <>
          {examWeek && day?.meetings.length === 0 && (
            <p className="mb-3 text-[11px] font-semibold text-sky-700">{t('exam.today.week', { type: examWeek.type, name: examWeek.name })}</p>
          )}
          <ul className="space-y-2 mb-4">
            <ExamRows rows={todayExams} />
          </ul>
        </>
      )}
      {body}
    </HomeCard>
  );

  if (loading) {
    return card(
      <div aria-busy="true">
        <Bone className="h-2.5 w-1/4" />
        <Bone className="h-3 w-1/6 mt-4" />
        <Bone className="h-5 w-3/5 mt-2" />
        <Bone className="h-3 w-1/2 mt-3" />
        <Bone className="h-10 w-1/2 mt-5" />
      </div>
    );
  }
  if (failed) return card(<HomeError message={t('teacherDash.schedule.failed')} />);
  if (live.length === 0) {
    return card(
      <HomeEmpty
        icon={CalendarX2}
        title={t('teacherDash.schedule.noTeaching')}
        action={
          <Button size="sm" variant="outline" onClick={() => navigate('/teacher/courses')}>
            {t('teacherDash.schedule.toCourses')}
          </Button>
        }
      />
    );
  }
  /* An exam day: its exams, above, are the day. */
  if (day.meetings.length === 0 && todayExams.length > 0) return card(null);
  if (day.meetings.length === 0) {
    const { next } = day;
    return card(
      <HomeEmpty
        icon={CalendarX2}
        title={examWeek ? t('exam.today.teacherNone', { type: examWeek.type, name: examWeek.name }) : t('teacherDash.schedule.noneToday')}
        body={
          next
            ? t('teacherDash.schedule.nextLine', {
                subject: next.subject?.name ?? next.subject?.code ?? '',
                className: next.class?.name ?? '',
                when: meetingWhen(next, lang, { weekday: 'long' }),
              })
            : null
        }
        action={
          next && (
            <Button size="sm" variant="outline" onClick={() => navigate(meetingPath(next))}>
              {t('teacherDash.schedule.openNext')}
            </Button>
          )
        }
      />
    );
  }

  const phased = day.meetings.map((meeting) => ({ meeting, phase: sessionPhase(meeting, now) }));
  const focus = FOCUS_ORDER.map((phase) => phased.find((entry) => entry.phase === phase)).find(Boolean) ?? null;
  const others = phased.filter((entry) => entry !== focus);

  return card(
    <>
      {focus ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t(`teacherDash.focus.${focus.phase}`)}</p>
          {focus.meeting.subject?.code && <p className="mt-3 text-xs font-bold text-brand">{focus.meeting.subject.code}</p>}
          <p className="mt-0.5 text-xl font-extrabold text-slate-900 tracking-tight break-words">{focus.meeting.subject?.name}</p>
          <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              {focus.meeting.local?.start} - {focus.meeting.local?.end}
            </span>
            {focus.meeting.class?.name && (
              <span className="inline-flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                {focus.meeting.class.name}
              </span>
            )}
            {focus.meeting.number && <span>{t('meeting.tab', { n: focus.meeting.number })}</span>}
          </p>
          <p className={`mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold ${focus.phase === 'upcoming' ? 'text-slate-500' : 'text-amber-700'}`}>
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            {focus.phase === 'upcoming' ? t('teacherDash.focus.startsAt', { time: focus.meeting.local?.start ?? '' }) : t('teacherDash.focus.awaitingLine')}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            {focus.phase !== 'upcoming' && (
              <Button onClick={() => navigate(meetingPath(focus.meeting, 'kehadiran'))}>
                <span className="inline-flex items-center gap-2">
                  <Check className="w-4 h-4" aria-hidden="true" />
                  {t('teacherDash.focus.confirm')}
                </span>
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate(meetingPath(focus.meeting, 'materi'))}>
              <span className="inline-flex items-center gap-2">
                <BookOpen className="w-4 h-4" aria-hidden="true" />
                {t('teacherDash.focus.materials')}
              </span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-3.5 py-3 text-sm font-bold text-emerald-700">
          <span className="grid place-items-center w-7 h-7 rounded-full bg-emerald-600 text-white shrink-0">
            <Check className="w-4 h-4" strokeWidth={3} aria-hidden="true" />
          </span>
          {t('teacherDash.focus.allDone')}
        </div>
      )}

      {others.length > 0 && (
        <div className={`${focus ? 'mt-5 pt-3.5 border-t border-slate-100' : 'mt-4'}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t(focus ? 'teacherDash.focus.others' : 'teacherDash.focus.all')}</p>
          <ul className="mt-2 space-y-0.5">
            {others.map(({ meeting, phase }) => (
              <li key={meeting.id}>
                <button
                  type="button"
                  onClick={() => navigate(meetingPath(meeting))}
                  className="group w-full flex items-center gap-3.5 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-slate-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className={`w-[52px] shrink-0 text-[13px] font-extrabold tabular-nums ${phase === 'confirmed' || phase === 'cancelled' ? 'text-slate-500' : 'text-slate-900'}`}>
                    {meeting.local?.start}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-[13px] font-bold text-slate-900 break-words ${phase === 'cancelled' ? 'line-through' : ''}`}>{meeting.subject?.name}</span>
                    <span className="block text-xs text-slate-500">
                      {meeting.class?.name}
                      {meeting.number && (
                        <>
                          {' '}
                          <span className="mx-1 text-slate-300" aria-hidden="true">
                            /
                          </span>{' '}
                          {t('meeting.tab', { n: meeting.number })}
                        </>
                      )}{' '}
                      <span className="mx-1 text-slate-300" aria-hidden="true">
                        /
                      </span>{' '}
                      <span className={`font-semibold ${PHASE_TEXT[phase] ?? 'text-slate-500'}`}>{t(`teach.phase.${phase}`)}</span>
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
};

export default TeachingDayCard;
