import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import { academicsService } from '../../services/academicsService';
import { sessionsService } from '../../services/sessionsService';
import { defaultSemesterOf } from '../Subjects/subjects';
import SessionList from '../Subjects/SessionList';
import SessionRoster from '../Subjects/SessionRoster';
import { classSubjectsOf } from './homeroomSubjects';

/*
  The homeroom teacher's class attendance, read only (owner, 2026-10-02; the
  teammate who owns the teacher side agreed this page is ours). Below ClassDetail
  on /teacher/homeroom — ClassDetail itself is shared with the Principal's page
  and is left alone.

  Three levels, each with a way back: the semester's subjects of the class (from
  the board), one subject's meetings (`GET /sessions/class-subjects/:id/sessions`,
  shared `SessionList`), one meeting's roster (shared `SessionRoster`). The
  backend lets a homeroom teacher read all three for their own class
  (sessions.service.js `assertCanRead`, attendance.service.js `canRead`).

  The semester opens on the one running today in the class's year, and can be
  changed within that year. Only live assignments are on the board, so an ended
  one's meetings are out of reach — the page says so. Times on the roster are the
  school's, from the subject's timetable (`GET …/schedule` → `timeZone`).
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3';

export const HomeroomAttendance = ({ classId, academicYearId }) => {
  const { t } = useT();
  const today = new Date().toISOString().slice(0, 10);

  const [year, setYear] = useState(null);
  const [semesterId, setSemesterId] = useState(null);
  const [board, setBoard] = useState({ data: null, error: null });
  const [subject, setSubject] = useState(null);
  const [sessions, setSessions] = useState({ list: null, zone: null, error: null });
  const [rosterSession, setRosterSession] = useState(null);
  const [error, setError] = useState(null);

  /* The class's year, for its semesters. */
  useEffect(() => {
    let cancelled = false;
    academicsService
      .academicYears()
      .then((years) => {
        if (cancelled) return;
        const found = years.find((entry) => entry.id === academicYearId) ?? null;
        setYear(found);
        setSemesterId(defaultSemesterOf(found, today));
      })
      .catch((err) => !cancelled && setError(apiErrorMessage(err, t)));
    return () => {
      cancelled = true;
    };
    // `today` is read once per mount on purpose: the semester shown should not jump at midnight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYearId, t]);

  /* The semester's board, for the class's subjects. */
  useEffect(() => {
    if (!semesterId) return undefined;
    let cancelled = false;
    setBoard({ data: null, error: null });
    setSubject(null);
    setRosterSession(null);
    academicsService
      .subjectBoard(semesterId)
      .then((data) => !cancelled && setBoard({ data, error: null }))
      .catch((err) => !cancelled && setBoard({ data: null, error: apiErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [semesterId, t]);

  /* One subject's meetings, and its zone for the roster's times. */
  useEffect(() => {
    if (!subject) return undefined;
    let cancelled = false;
    setSessions({ list: null, zone: null, error: null });
    Promise.all([sessionsService.sessions(subject.classSubjectId), sessionsService.schedule(subject.classSubjectId)])
      .then(([list, schedule]) => !cancelled && setSessions({ list, zone: schedule?.timeZone ?? null, error: null }))
      .catch((err) => !cancelled && setSessions({ list: null, zone: null, error: apiErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [subject, t]);

  const subjects = useMemo(() => classSubjectsOf(board.data, classId), [board.data, classId]);
  const semesters = year?.semesters ?? [];

  const heading = (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <h3 className="text-base font-extrabold text-slate-900">{t('homeroom.att.title')}</h3>
      {semesters.length > 1 && (
        <label className="flex items-center gap-2">
          <span className="sr-only">{t('homeroom.att.semester')}</span>
          <select
            value={semesterId ?? ''}
            onChange={(e) => setSemesterId(e.target.value)}
            className="w-full sm:w-44 rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand cursor-pointer"
          >
            {semesters.map((semester) => (
              <option key={semester.id} value={semester.id}>
                {t('classes.semester.name', { n: semester.ordinal })}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );

  const back = (label, onClick) => (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-extrabold text-brand hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
    >
      <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
      {label}
    </button>
  );

  const message = (text, alert = false) => (
    <p className={`text-xs font-semibold leading-relaxed ${alert ? 'text-red-600' : 'text-slate-500'}`} role={alert ? 'alert' : undefined}>
      {text}
    </p>
  );
  const loading = <div className="h-20 bg-slate-50 rounded-xl animate-pulse" aria-label={t('common.loading')} />;

  let body;
  if (error) body = message(error, true);
  else if (!year) body = loading;
  else if (semesters.length === 0) body = message(t('homeroom.att.noSemester'));
  else if (rosterSession) body = <SessionRoster session={rosterSession} zone={sessions.zone} onBack={() => setRosterSession(null)} />;
  else if (subject) {
    body = (
      <div className="space-y-2">
        {back(t('homeroom.att.allSubjects'), () => setSubject(null))}
        <p className="text-sm font-extrabold text-slate-800 break-words">
          {subject.subject.name} <span className="font-semibold text-slate-500">· {subject.teacher.fullName}</span>
        </p>
        {sessions.error
          ? message(sessions.error, true)
          : sessions.list === null
            ? loading
            : sessions.list.length === 0
              ? message(t('timetable.noSessions'))
              : <SessionList sessions={sessions.list} onOpen={setRosterSession} />}
      </div>
    );
  } else if (board.error) body = message(board.error, true);
  else if (board.data === null) body = loading;
  else if (subjects.length === 0) body = message(t('homeroom.att.noSubjects'));
  else {
    body = (
      <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
        {subjects.map((row) => (
          <li key={row.classSubjectId}>
            <button
              type="button"
              onClick={() => setSubject(row)}
              className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
            >
              <span className="min-w-0">
                <span className="block text-xs font-bold text-slate-800 break-words">{row.subject.name}</span>
                <span className="block text-[11px] font-semibold text-slate-500 break-words">{row.teacher.fullName}</span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className={card} aria-label={t('homeroom.att.title')}>
      {heading}
      {body}
      {!rosterSession && year && semesters.length > 0 && (
        <p className="text-[11px] font-semibold text-slate-500 leading-relaxed">{t('homeroom.att.liveOnly')}</p>
      )}
    </section>
  );
};

export default HomeroomAttendance;
