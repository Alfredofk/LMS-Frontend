import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, Check, ChevronRight, ClipboardList, Search } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import Select from '../../components/ui/Select';
import EmptyCard from '../../components/ui/EmptyCard';
import FactLine from '../../components/ui/FactLine';
import ThreePartBar from '../../components/ThreePartBar';
import { Bone, HomeError } from '../Dashboard/components/HomeCard';
import { readMyProgress } from './readMyProgress';
import { materialsOf, rateOf } from './myProgress';
import ClassroomSubject from './ClassroomSubject';
import { readMyClasses } from './readMyClasses';
import { readMyMenu } from '../StudentAssessment/readMyMenu';
import { todoCount } from '../StudentAssessment/studentMenu';
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
  named with that class. Its cards sit below the current class's, under
  "Dari kelas sebelumnya: <class>", one section per earlier class (owner,
  2026-10-17: mixed into one grid they read as subjects of the class in the
  subtitle; a section heading replaced the per-card label). An ended
  assignment shows as its own card, marked "Sudah berakhir", only when it has
  meetings (`listedClassSubjects`).

  A card says how many of its assessments wait to be done (owner, 2026-10-12),
  from the shown semester's GET /assessments/mine (readMyMenu); nothing when none
  wait or the read fails.

  It replaced a page of sample components that rendered "not built yet": there
  was no route a student could read their subjects on until backend 1bd81ab.

  `scores` (owner, 2026-10-14, as the teacher's "Buku Nilai"): the sidebar's
  "Nilai" (/scores, StudentScores) - the same cards and dropdown under its own
  title, each opening that subject's "Nilai" tab.
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm min-w-0';

/*
  Up to three cards to a row, each at least 17.5rem so no line inside a card wraps
  (owner, 2026-10-04: two cards stretched across the page read too long, and three
  squeezed at 1024px wrapped their text). So: three on an ordinary laptop, two on
  a small one or a tablet, one on a phone. Each column is at least a third of the
  row, so a wide screen keeps three rather than four, and two subjects take two
  thirds of the row. It follows the area beside the sidebar, not the viewport.
*/
const cardGrid = 'grid grid-cols-[repeat(auto-fill,minmax(max(17.5rem,calc((100%-2rem)/3)),1fr))] gap-4';

/*
  A subject as a card (the look since 2026-10-28, the mockup the owner reviewed):
  the dashboards' frame, lifting with its arrow on hover; the teacher as plain grey
  text; the materials the student has finished as the three-part bar of "Kemajuan
  mapel" (owner's pick B, from GET /tracking/me/progress), or "Belum ada materi";
  and the next meeting as one grey line on the card's floor.

  @param materials  materialsOf's row; undefined while reading, null when the read failed
*/
const SubjectCard = ({ entry, sessions, materials, todo, onOpen }) => {
  const { t, lang } = useT();
  const progress = progressOf(sessions);

  let line;
  if (progress === null) line = <span className="text-amber-700">{t('classroom.meetingsFailed')}</span>;
  else if (progress.total === 0) line = t('classroom.noMeetings');
  else if (progress.current) line = <span className="font-bold text-emerald-700">{t('classroom.now')}</span>;
  else if (progress.next) line = t('classroom.next', { when: meetingWhen(progress.next, lang) });
  else line = t('classroom.done');

  const full = materials?.published > 0 && materials.done === materials.published;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${card} group w-full text-left hover:shadow-md hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand flex flex-col gap-3`}
    >
      {/* Code above the name, as on the subject's own page (owner, 2026-10-04). */}
      {/* No icon tile (owner, 2026-10-07), as on the teacher's "Kelas Saya". */}
      <span className="flex items-start gap-3">
        <span className="min-w-0 flex-1">
          {entry.subject.code && (
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-brand leading-none">
              {entry.subject.code}
            </span>
          )}
          <span className="block mt-1 text-base font-extrabold text-slate-900 leading-tight break-words">
            {entry.subject.name}
          </span>
          <span className="block mt-1 text-xs font-semibold text-slate-500 truncate">{entry.teacher.fullName}</span>
        </span>
        <ChevronRight className="w-4 h-4 mt-1 text-slate-400 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden="true" />
      </span>

      {entry.ended && (
        <span className="flex flex-wrap gap-1.5">
          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[11px] font-bold">{t('classroom.ended')}</span>
        </span>
      )}

      {materials === undefined ? (
        <span className="block" aria-hidden="true">
          <Bone className="h-3 w-1/2" />
          <Bone className="h-2 w-full mt-2.5" />
        </span>
      ) : materials === null ? null : materials.published === 0 ? (
        <span className="block text-[12.5px] text-slate-500">{t('dash.subj.noneYet')}</span>
      ) : (
        <span className="block">
          <span className="flex items-baseline justify-between gap-2 text-[12.5px] text-slate-500 tabular-nums">
            <span>{t('meeting.materialsDone', { done: materials.done, n: materials.published })}</span>
            {full ? (
              <span className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden="true" />
                {t('dash.subj.full')}
              </span>
            ) : (
              <span className="shrink-0 text-sm font-extrabold text-slate-700">{rateOf(materials.done, materials.published)}%</span>
            )}
          </span>
          <ThreePartBar
            done={materials.done}
            opened={materials.opened}
            total={materials.published}
            className="mt-1.5"
            label={t('dash.subj.bar', { done: materials.done, opened: materials.opened - materials.done, none: materials.published - materials.opened })}
          />
        </span>
      )}

      {todo > 0 && (
        <span className="flex items-center gap-1.5 text-xs font-bold text-brand">
          <ClipboardList className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
          {t('classroom.assessmentsTodo', { n: todo })}
        </span>
      )}

      {/* mt-auto: on the card's floor whatever sits above it, so a row of cards lines up. */}
      <span className="mt-auto block pt-2.5 border-t border-slate-100 text-[12.5px] font-semibold text-slate-600">{line}</span>
    </button>
  );
};

export const SubjectList = ({ scores = false }) => {
  const { t } = useT();
  const navigate = useNavigate();
  const { membership } = useAuth();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';

  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [semesterId, setSemesterId] = useState(null);
  /* The shown semester's assessment menu, for each card's "to do" count: { semesterId, classes }. */
  const [menu, setMenu] = useState(null);
  /* GET /tracking/me/progress, for each card's materials (owner, 2026-10-28): undefined
     while reading, null when it failed. Kept a minute, shared with the dashboard. */
  const [materials, setMaterials] = useState(undefined);

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
    readMyProgress(membership?.id, { fresh: attempt > 0 })
      .then((answer) => !cancelled && setMaterials(answer))
      .catch(() => !cancelled && setMaterials(null));
    return () => {
      cancelled = true;
    };
  }, [attempt, membership?.id]);

  const listed = useMemo(() => (data ? listedClassSubjects(data.classSubjects, data.sessionsById) : []), [data]);
  const semesters = useMemo(() => semestersOf(listed), [listed]);
  const fallback = useMemo(() => (data ? defaultSemesterId(listed, data.sessionsById) : null), [data, listed]);
  const shownSemester = semesterId ?? fallback;

  useEffect(() => {
    if (!shownSemester) return undefined;
    let cancelled = false;
    readMyMenu(membership?.id, shownSemester)
      .then((answer) => !cancelled && setMenu({ semesterId: shownSemester, classes: answer.classes }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [membership?.id, shownSemester]);
  const menuClasses = menu?.semesterId === shownSemester ? menu.classes : null;
  const subjects = listed.filter((entry) => entry.semester?.id === shownSemester);
  const visible = subjects.filter((entry) => matchesSearch(entry, query));
  /* The current class's cards, then each earlier class's under its own heading,
     in the order the backend gives them (the latest left first). */
  const currentCards = visible.filter(isCurrentClass);
  const pastGroups = [];
  for (const entry of visible) {
    if (isCurrentClass(entry)) continue;
    const group = pastGroups.find((g) => g.classId === entry.class.id);
    if (group) group.entries.push(entry);
    else pastGroups.push({ classId: entry.class.id, name: entry.class.name, entries: [entry] });
  }
  const renderCard = (entry) => (
    <SubjectCard
      key={entry.id}
      entry={entry}
      sessions={data.sessionsById[entry.id]}
      materials={materials === undefined || materials === null ? materials : materialsOf(materials, entry.id)}
      todo={menuClasses ? todoCount(menuClasses, entry.id) : 0}
      onOpen={() => navigate(scores ? `/classroom/${entry.id}?tab=nilai` : `/classroom/${entry.id}`)}
    />
  );

  const placed = membership?.student?.class ?? null;
  const first = listed.find(isCurrentClass);
  /* The slash line, as on the dashboards (owner, 2026-10-28, the reviewed mockup): the
     school, the class, the semester shown, how many subjects it holds. */
  const shown = semesters.find((semester) => semester.id === shownSemester) ?? null;
  const facts = [
    membership?.school?.name ?? membership?.schoolName,
    first?.class?.name ?? placed?.name,
    shown && t('teacherDash.academicContext', { year: shown.academicYear, n: shown.ordinal }),
    data && shown && t('classroom.subjectCount', { n: subjects.length }),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">{t(scores ? 'shell.scores' : 'shell.myCourses')}</h1>
        {scores ? (
          <p className="mt-1 text-sm text-slate-500 font-medium">{t('scores.pick')}</p>
        ) : (
          <FactLine className="mt-2" facts={facts} />
        )}
      </div>

      {failed && !data ? (
        <HomeError message={t('classroom.failed')} retryLabel={t('att.error.retry')} onRetry={() => setAttempt((n) => n + 1)} />
      ) : !data ? (
        <div className={cardGrid} aria-busy="true" aria-label={t('common.loading')}>
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-40 rounded-2xl bg-white border border-slate-100 animate-pulse" />
          ))}
        </div>
      ) : listed.length === 0 ? (
        <EmptyCard icon={BookOpen} title={t('classroom.empty.title')} body={t(placed ? 'classroom.empty.none' : 'classroom.empty.noClass')} />
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
            <EmptyCard icon={Search} title={t('classroom.empty.search', { q: query.trim() })} />
          ) : (
            <>
              {currentCards.length > 0 && <div className={cardGrid}>{currentCards.map(renderCard)}</div>}
              {pastGroups.map((group) => (
                <section key={group.classId} className="space-y-3" aria-labelledby={`past-class-${group.classId}`}>
                  <h2 id={`past-class-${group.classId}`} className="text-sm font-extrabold text-slate-700">
                    {t('classroom.pastSection', { class: group.name })}
                  </h2>
                  <div className={cardGrid}>{group.entries.map(renderCard)}</div>
                </section>
              ))}
            </>
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
