import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, BookOpen, CalendarClock, ChevronRight, RefreshCw, UserRound } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import Select from '../../components/ui/Select';
import ClassroomSubject from './ClassroomSubject';
import { readMyClasses } from './readMyClasses';
import { defaultSemesterId, isCurrentClass, listedClassSubjects, matchesSearch, meetingWhen, progressOf, semestersOf } from './myClasses';

/*
  "Kelas Saya" for a student (owner, 2026-10-04): the subjects of the class they
  sit in, as cards, a semester at a time (a dropdown); a card opens /classroom/:classSubjectId
  (ClassroomSubject), whose meetings open their materials.

  Everything comes from readMyClasses (1 + N reads, kept a minute). The semester
  shown first is the one the meetings say is on (`defaultSemesterId`). The
  navbar's search box (`?q=`) narrows the cards by code, name or teacher.

  Since backend 4bdd397 (request #11; owner, 2026-10-07) it looks back too: the
  dropdown holds every class the student sat in, an earlier class's semester
  named with that class, and its cards marked "Kelas sebelumnya". An ended
  assignment shows as its own card, marked "Sudah berakhir", only when it has
  meetings (`listedClassSubjects`).

  It replaced a page of sample components that rendered "not built yet": there
  was no route a student could read their subjects on until backend 1bd81ab.
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 shadow-sm';

/*
  Up to three cards to a row, each at least 17.5rem so no line inside a card wraps
  (owner, 2026-10-04: two cards stretched across the page read too long, and three
  squeezed at 1024px wrapped their text). So: three on an ordinary laptop, two on
  a small one or a tablet, one on a phone. Each column is at least a third of the
  row, so a wide screen keeps three rather than four, and two subjects take two
  thirds of the row. It follows the area beside the sidebar, not the viewport.
*/
const cardGrid = 'grid grid-cols-[repeat(auto-fill,minmax(max(17.5rem,calc((100%-2rem)/3)),1fr))] gap-4';

const SubjectCard = ({ entry, sessions, onOpen }) => {
  const { t, lang } = useT();
  const progress = progressOf(sessions);
  const percent = progress?.total ? Math.round((progress.held / progress.total) * 100) : 0;

  let line;
  if (progress === null) line = <span className="text-amber-700">{t('classroom.meetingsFailed')}</span>;
  else if (progress.total === 0) line = <span className="text-slate-500">{t('classroom.noMeetings')}</span>;
  else if (progress.current) line = <span className="text-emerald-700">{t('classroom.now')}</span>;
  else if (progress.next) line = <span className="text-slate-600">{t('classroom.next', { when: meetingWhen(progress.next, lang) })}</span>;
  else line = <span className="text-slate-500">{t('classroom.done')}</span>;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${card} group w-full text-left hover:shadow-md hover:border-brand/30 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand flex flex-col gap-3`}
    >
      {/* Code above the name, as on the subject's own page (owner, 2026-10-04). */}
      {/* No icon tile (owner, 2026-10-07), as on the teacher's "Kelas Saya". */}
      <span className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          {entry.subject.code && (
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-brand leading-none">
              {entry.subject.code}
            </span>
          )}
          <span className="block mt-1 text-base font-extrabold text-slate-900 leading-tight break-words">
            {entry.subject.name}
          </span>
          <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-slate-500 min-w-0">
            <UserRound className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{entry.teacher.fullName}</span>
          </span>
        </span>
        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand shrink-0" aria-hidden="true" />
      </span>

      {(!isCurrentClass(entry) || entry.ended) && (
        <span className="flex flex-wrap gap-1.5">
          {!isCurrentClass(entry) && (
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-bold">
              {t('classroom.pastClass', { class: entry.class.name })}
            </span>
          )}
          {entry.ended && (
            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[11px] font-bold">{t('classroom.ended')}</span>
          )}
        </span>
      )}

      {progress?.total > 0 && (
        <span className="block space-y-1.5">
          <span className="flex items-center justify-between text-[11px] font-semibold text-slate-500 tabular-nums">
            <span>{t('classroom.progress', { held: progress.held, total: progress.total })}</span>
            <span>{percent}%</span>
          </span>
          <span className="block h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
            <span className="block h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
          </span>
        </span>
      )}

      {/* mt-auto: on the card's floor whatever sits above it, so a row of cards lines up. */}
      <span className="mt-auto flex items-center gap-1.5 text-xs font-bold">
        <CalendarClock className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
        {line}
      </span>
    </button>
  );
};

const SubjectList = () => {
  const { t } = useT();
  const navigate = useNavigate();
  const { membership } = useAuth();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';

  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [semesterId, setSemesterId] = useState(null);

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

  const listed = useMemo(() => (data ? listedClassSubjects(data.classSubjects, data.sessionsById) : []), [data]);
  const semesters = useMemo(() => semestersOf(listed), [listed]);
  const fallback = useMemo(() => (data ? defaultSemesterId(listed, data.sessionsById) : null), [data, listed]);
  const shownSemester = semesterId ?? fallback;
  const subjects = listed.filter((entry) => entry.semester?.id === shownSemester);
  const visible = subjects.filter((entry) => matchesSearch(entry, query));

  const placed = membership?.student?.class ?? null;
  const first = listed.find(isCurrentClass);
  const subtitle = first
    ? t('classroom.subtitle', { class: first.class.name, year: first.semester.academicYear })
    : placed
      ? t('classroom.subtitle', { class: placed.name, year: placed.academicYear ?? '' })
      : null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('shell.myCourses')}</h1>
        {subtitle && <p className="text-sm text-slate-500 font-medium">{subtitle}</p>}
      </div>

      {failed && !data ? (
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
      ) : !data ? (
        <div className={cardGrid} aria-busy="true" aria-label={t('common.loading')}>
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-40 rounded-2xl bg-white border border-slate-100 animate-pulse" />
          ))}
        </div>
      ) : listed.length === 0 ? (
        <div className={`${card} flex flex-col items-center text-center gap-3 py-10`}>
          <BookOpen className="w-8 h-8 text-slate-400" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-600 max-w-sm">
            {t(placed ? 'classroom.empty.none' : 'classroom.empty.noClass')}
          </p>
        </div>
      ) : (
        <>
          {/* The same plain dropdown as the teacher's, on the left, newest first (owner,
              2026-10-05); an earlier class's semester carries its name (2026-10-07). */}
          {semesters.length > 0 && (
            <div className="flex">
              <Select
                id="classroom-semester"
                className="w-full sm:w-64"
                aria-label={t('classroom.semesters')}
                value={shownSemester ?? ''}
                onChange={(e) => setSemesterId(e.target.value)}
              >
                {[...semesters].reverse().map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semester.pastClass
                      ? t('classroom.semesterPast', { n: semester.ordinal, year: semester.academicYear, class: semester.pastClass })
                      : t('teach.option', { n: semester.ordinal, year: semester.academicYear })}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {visible.length === 0 ? (
            <p className={`${card} text-sm font-semibold text-slate-600 text-center py-8`}>
              {t('classroom.empty.search', { q: query.trim() })}
            </p>
          ) : (
            <div className={cardGrid}>
              {visible.map((entry) => (
                <SubjectCard
                  key={entry.id}
                  entry={entry}
                  sessions={data.sessionsById[entry.id]}
                  onOpen={() => navigate(`/classroom/${entry.id}`)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export const ClassroomPage = () => {
  const { classSubjectId, sessionId } = useParams();
  return classSubjectId ? (
    <ClassroomSubject key={classSubjectId} classSubjectId={classSubjectId} legacySessionId={sessionId ?? null} />
  ) : (
    <SubjectList />
  );
};

export default ClassroomPage;
