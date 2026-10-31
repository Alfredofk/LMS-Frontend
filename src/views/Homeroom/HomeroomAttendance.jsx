import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, ClipboardList, GraduationCap, Info } from 'lucide-react';

import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';

import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import { academicsService } from '../../services/academicsService';
import { sessionsService } from '../../services/sessionsService';
import { defaultSemesterOf } from '../Subjects/subjects';
import SessionList from '../Subjects/SessionList';
import SessionRoster from '../Subjects/SessionRoster';
import { RosterError } from '../Attendance/RosterParts';
import { classSubjectsOf } from './homeroomSubjects';
import AssessmentReader from '../TeacherAssessment/AssessmentReader';
import GradebookReader from '../Gradebook/GradebookReader';

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
  A subject also opens its assessments, read only, in place (AssessmentReader;
  backend 0bb4598 lets the homeroom teacher read them, owner 2026-10-08).

  The semester opens on the one running today in the class's year, and can be
  changed within that year. Only live assignments are on the board, so an ended
  one's meetings are out of reach — the page says so. Times on the roster are the
  school's, from the subject's timetable (`GET …/schedule` → `timeZone`).

  The look is the mockup kehadiran-guru-wali.html (owner, 2026-10-30, items 8-13):
  a slash line under the title, the app's Select, a subject as "EKO - Ekonomi"
  over its teacher, outline buttons, errors in rose boxes, the note an info line.
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4';

export const HomeroomAttendance = ({ classId, academicYearId }) => {
  const { t } = useT();
  const today = new Date().toISOString().slice(0, 10);

  const [year, setYear] = useState(null);
  const [semesterId, setSemesterId] = useState(null);
  const [board, setBoard] = useState({ data: null, error: null });
  const [subject, setSubject] = useState(null);
  const [sessions, setSessions] = useState({ list: null, zone: null, error: null });
  const [rosterSession, setRosterSession] = useState(null);
  const [assessmentsOpen, setAssessmentsOpen] = useState(false);
  const [gradebookOpen, setGradebookOpen] = useState(false);
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
    setAssessmentsOpen(false);
    setGradebookOpen(false);
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

  const semester = semesters.find((entry) => entry.id === semesterId) ?? null;
  const heading = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
          {t(subject && assessmentsOpen ? 'tasm.pageTitle' : subject && gradebookOpen ? 'gradebook.readerTitle' : 'homeroom.att.title')}
        </h3>
        {semester && year && (
          <p className="mt-0.5 text-[13px] font-medium text-slate-500">
            <span className="whitespace-nowrap">{t('grading.fin.semesterOption', { n: semester.ordinal, year: year.label })}</span>
            {board.data && (
              <>
                {' '}
                <span className="mx-1 text-slate-300" aria-hidden="true">
                  /
                </span>{' '}
                <span className="whitespace-nowrap">{t('homeroom.att.subjectCount', { n: subjects.length })}</span>
              </>
            )}
          </p>
        )}
      </div>
      {semesters.length > 1 && (
        <div className="w-full sm:w-44">
          <Select value={semesterId ?? ''} onChange={(e) => setSemesterId(e.target.value)} aria-label={t('homeroom.att.semester')}>
            {semesters.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {t('classes.semester.name', { n: entry.ordinal })}
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );

  const back = (label, onClick) => (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-[13px] font-bold text-brand hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
    >
      <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
      {label}
    </button>
  );

  const message = (text, alert = false) =>
    alert ? <RosterError>{text}</RosterError> : <p className="text-[13px] font-medium leading-relaxed text-slate-500">{text}</p>;
  const loading = <div className="h-20 bg-slate-100 rounded-xl animate-pulse motion-reduce:animate-none" aria-label={t('common.loading')} />;

  let body;
  if (error) body = message(error, true);
  else if (!year) body = loading;
  else if (semesters.length === 0) body = message(t('homeroom.att.noSemester'));
  else if (rosterSession) body = <SessionRoster session={rosterSession} zone={sessions.zone} onBack={() => setRosterSession(null)} />;
  else if (subject && assessmentsOpen) body = <AssessmentReader classSubjectId={subject.classSubjectId} onBack={() => setAssessmentsOpen(false)} showTitle={false} />;
  else if (subject && gradebookOpen) {
    body = <GradebookReader classSubjectId={subject.classSubjectId} name={[subject.subject.code, subject.subject.name].filter(Boolean).join(' ')} onBack={() => setGradebookOpen(false)} showTitle={false} />;
  }
  else if (subject) {
    body = (
      <div className="space-y-4">
        {back(t('homeroom.att.allSubjects'), () => setSubject(null))}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-extrabold text-slate-900 break-words">
              {subject.subject.code && <span className="text-brand">{subject.subject.code}</span>}
              {subject.subject.code && ' - '}
              {subject.subject.name}
            </p>
            <p className="mt-0.5 text-[13px] font-medium text-slate-500 break-words">{subject.teacher.fullName}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setAssessmentsOpen(true)}>
              <ClipboardList className="w-4 h-4 mr-1.5" aria-hidden="true" />
              {t('tasm.reader.open')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setGradebookOpen(true)}>
              <GraduationCap className="w-4 h-4 mr-1.5" aria-hidden="true" />
              {t('gradebook.open')}
            </Button>
          </div>
        </div>
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
      <ul className="divide-y divide-slate-100">
        {subjects.map((row) => (
          <li key={row.classSubjectId}>
            <button
              type="button"
              onClick={() => {
                setSubject(row);
                setAssessmentsOpen(false);
              }}
              className="group w-full px-2 py-2.5 flex items-center justify-between gap-3 text-left rounded-xl hover:bg-slate-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
            >
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-900 break-words">
                  {row.subject.code && <span className="font-extrabold text-brand">{row.subject.code}</span>}
                  {row.subject.code && ' - '}
                  {row.subject.name}
                </span>
                <span className="block text-[12.5px] font-medium text-slate-500 break-words">{row.teacher.fullName}</span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
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
      {!rosterSession && !(subject && assessmentsOpen) && year && semesters.length > 0 && (
        <p className="flex items-start gap-2 border-t border-slate-100 pt-3 text-[12.5px] font-medium text-slate-500 leading-relaxed">
          <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          {t('homeroom.att.liveOnly')}
        </p>
      )}
    </section>
  );
};

export default HomeroomAttendance;
