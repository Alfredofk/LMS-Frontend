import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, BookOpen, CalendarRange, ChevronDown, History, Layers, RefreshCw, School, UserRound } from 'lucide-react';

import InfoChips from '../../components/ui/InfoChips';
import { useT } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { attendanceService } from '../../services/attendanceService';
import { summarize } from '../Attendance/attendance';
import AttendanceSummaryCard from '../Attendance/AttendanceSummaryCard';
import ClassroomMeeting from './ClassroomMeeting';
import { noteMeetingMaterials, readMyClasses, withMeetingMaterials } from './readMyClasses';
import { meetingDone } from './materialProgress';
import { defaultMeetingId, isCurrentClass, progressOf, shownSessions } from './myClasses';
import MeetingStrip from '../../components/meetings/MeetingStrip';
import SubjectHeader, { PersonFact } from '../../components/meetings/SubjectHeader';

/*
  One subject of the student's class (owner, 2026-10-04, after BINUSMAYA's
  course page - a reference, not a copy): who teaches it and how far it has come,
  then two tabs.

  - "Pertemuan": a row of meeting tabs (meetingWindow, the rest behind "N more"),
    each dotted with the student's own attendance and ticked when all its
    materials are done (the list's `content` count, backend 4bdd397), and the
    chosen meeting below
    it (ClassroomMeeting: its materials and what to do). The page opens on the
    meeting running now, else the next (defaultMeetingId).
  - "Kehadiran": the student's numbers for this subject (summarize).

  The tabs live in the address - `?tab=kehadiran`, `?pertemuan=<session id>` - so
  a link opens the right one and Back steps through them. A query change keeps
  the scroll where it is (MainLayout resets it on a path change only). The older
  `/classroom/:id/:sessionId` links still open that meeting.

  An earlier class's subject (`current: false`, backend 4bdd397; owner,
  2026-10-07) is read only: a note says so, no check-in, nothing tracked - the
  materials keep the ticks earned back then. An ended assignment says it ended.

  Only tabs with data behind them are shown: there is no syllabus, forum,
  assignment, grade or roster route for a student yet.
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 shadow-sm';

const DOT = {
  PRESENT: 'bg-emerald-500',
  SICK: 'bg-amber-400',
  EXCUSED: 'bg-sky-500',
  ABSENT: 'bg-rose-500',
};

const SECTIONS = ['pertemuan', 'kehadiran'];

const AttendanceSummary = ({ rows, t }) => {
  if (rows === false) return <p className={`${card} text-sm font-semibold text-amber-700`}>{t('classroom.attFailed')}</p>;
  if (rows === null) return <div className="h-32 rounded-2xl bg-white border border-slate-100 animate-pulse" />;
  /* The same card as /attendance, over this subject alone (owner, 2026-10-04). */
  return <AttendanceSummaryCard total={summarize(rows)} headingId="subject-att-summary" />;
};

export const ClassroomSubject = ({ classSubjectId, legacySessionId = null }) => {
  const { t } = useT();
  const { membership } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  /* The student's rows for this subject; false when the read failed. */
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let cancelled = false;
    readMyClasses(membership?.id, { fresh: attempt > 0 })
      .then((answer) => {
        if (cancelled) return;
        setData(answer);
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [attempt, membership?.id]);

  useEffect(() => {
    let cancelled = false;
    attendanceService
      .mine(classSubjectId)
      .then((list) => !cancelled && setRows(list))
      .catch(() => !cancelled && setRows(false));
    return () => {
      cancelled = true;
    };
  }, [classSubjectId]);

  const entry = data?.classSubjects.find((item) => item.id === classSubjectId) ?? null;
  const readOnly = Boolean(entry) && !isCurrentClass(entry);
  const rawSessions = data?.sessionsById?.[classSubjectId];
  const sessions = useMemo(
    () => (Array.isArray(rawSessions) ? shownSessions(rawSessions).sort((a, b) => a.number - b.number) : null),
    [rawSessions]
  );
  const rowBySession = useMemo(
    () => (Array.isArray(rows) ? new Map(rows.map((row) => [row.session?.id, row])) : null),
    [rows]
  );
  const progress = progressOf(rawSessions);
  const percent = progress?.total ? Math.round((progress.held / progress.total) * 100) : 0;

  const section = SECTIONS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'pertemuan';
  const asked = searchParams.get('pertemuan') ?? legacySessionId;
  const selectedId = sessions
    ? sessions.some((session) => session.id === asked)
      ? asked
      : defaultMeetingId(sessions)
    : null;
  const selected = sessions?.find((session) => session.id === selectedId) ?? null;

  const pick = (id) => setSearchParams({ pertemuan: id });
  const goSection = (next) =>
    setSearchParams(next === 'pertemuan' ? (selectedId ? { pertemuan: selectedId } : {}) : { tab: next });

  /* A material finished in the open meeting ticks its tab at once, here and in
     what readMyClasses keeps. */
  const onMaterials = useCallback(
    (sessionId, content) => {
      noteMeetingMaterials(membership?.id, classSubjectId, sessionId, content);
      setData((current) => withMeetingMaterials(current, classSubjectId, sessionId, content));
    },
    [membership?.id, classSubjectId]
  );

  /* A check-in taken on this page shows on the tabs and in the summary at once. */
  const onAttendance = (row) =>
    setRows((current) =>
      Array.isArray(current) ? [...current.filter((item) => item.session?.id !== row.session?.id), row] : current
    );

  if (failed && !data) {
    return (
      <div className={`${card} flex flex-col items-center text-center gap-3 py-10`} role="alert">
        <AlertCircle className="w-8 h-8 text-rose-500" aria-hidden="true" />
        <p className="text-sm font-bold text-slate-700">{t('classroom.failed')}</p>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          {t('att.error.retry')}
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label={t('common.loading')}>
        <div className="h-36 rounded-2xl bg-white border border-slate-100 animate-pulse" />
        <div className="h-64 rounded-2xl bg-white border border-slate-100 animate-pulse" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className={`${card} flex flex-col items-center text-center gap-3 py-10`}>
        <BookOpen className="w-8 h-8 text-slate-400" aria-hidden="true" />
        <p className="text-sm font-semibold text-slate-600 max-w-sm">{t('classroom.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* The subject's header (owner, 2026-10-04): the code as a small label above
          the name, then the facts as labelled cells instead of a row of pills, the
          teacher first, then how far the subject has come. */}
      <SubjectHeader
        code={entry.subject.code}
        name={entry.subject.name}
        facts={[
          { label: t('classroom.teacher'), value: <PersonFact name={entry.teacher.fullName} /> },
          { label: t('person.class'), value: entry.class.name },
          { label: t('classroom.semesters'), value: entry.semester.ordinal },
          { label: t('person.year'), value: entry.semester.academicYear },
        ]}
        progress={progress?.total > 0 ? { label: t('classroom.progress', { held: progress.held, total: progress.total }), percent } : null}
      />

      {(readOnly || entry.ended) && (
        <p className="flex items-start gap-2.5 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
          <History className="w-4 h-4 mt-0.5 text-slate-500 shrink-0" aria-hidden="true" />
          {readOnly ? t('classroom.pastClassNote', { class: entry.class.name }) : t('classroom.endedNote')}
        </p>
      )}

      <div role="tablist" aria-label={t('meeting.sections')} className="flex gap-6 border-b border-slate-200">
        {SECTIONS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={section === key}
            onClick={() => goSection(key)}
            className={`px-1 pb-3 -mb-px text-sm font-extrabold border-b-2 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-t ${
              section === key ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t(`meeting.section.${key}`)}
          </button>
        ))}
      </div>

      {section === 'kehadiran' ? (
        <AttendanceSummary rows={rows} t={t} />
      ) : sessions === null ? (
        <p className={`${card} text-sm font-semibold text-amber-700`}>{t('classroom.meetingsFailed')}</p>
      ) : sessions.length === 0 ? (
        <p className={`${card} text-sm font-semibold text-slate-600`}>{t('classroom.noMeetings')}</p>
      ) : (
        <div className="space-y-5">
          <MeetingStrip
            sessions={sessions}
            selectedId={selectedId}
            onPick={pick}
            dotOf={(session) => {
              const row = rowBySession?.get(session.id);
              return row ? DOT[row.status] ?? 'bg-slate-400' : null;
            }}
            doneOf={(session) => meetingDone(session.content)}
          />

          {selected && (
            <ClassroomMeeting
              key={selected.id}
              meeting={selected}
              attendance={rows === false ? false : rowBySession ? rowBySession.get(selected.id) ?? null : undefined}
              onAttendance={onAttendance}
              onMaterials={onMaterials}
              readOnly={readOnly}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default ClassroomSubject;
