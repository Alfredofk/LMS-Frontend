import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, Lock } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import MeetingStrip from '../../components/meetings/MeetingStrip';
import SubjectHeader from '../../components/meetings/SubjectHeader';
import SubjectProgress from '../Subjects/SubjectProgress';
import { defaultMeetingId, progressOf, shownSessions } from '../Classroom/myClasses';
import { readMyTeaching, forgetMyTeaching } from './readMyTeaching';
import { academicsService } from '../../services/academicsService';
import { openSemesterIds } from '../Dashboard/teacherHome';
import { sessionPhase, unconfirmedCount } from './teaching';
import TeacherMeeting from './TeacherMeeting';
import AssessmentsTab from '../TeacherAssessment/AssessmentsTab';
import { waitingInSlot } from '../TeacherAssessment/markingQueue';
import { readTeachingDashboard } from '../Dashboard/teachingDashboard';
import { HomeError } from '../Dashboard/components/HomeCard';
import EmptyCard from '../../components/ui/EmptyCard';
import GradebookTable from '../Gradebook/GradebookTable';
import SlotGradeSettings from '../Grading/SlotGradeSettings';
import SlotDescriptions from '../Grading/SlotDescriptions';
import FinalisingCard from '../Grading/FinalisingCard';
import { descriptionRows, isChanged } from '../Grading/descriptions';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import { useSchoolZone } from '../../hooks/useSchoolToday';

/*
  One subject a teacher teaches (owner, 2026-10-04; it replaced the teammate's
  sample-data page): the same shape as a student's subject page - the subject and
  its facts, then two tabs.

  - "Pertemuan": the meetings as a row of tabs (MeetingStrip), a dot on each one
    begun and not yet confirmed; the chosen one (`?pertemuan=<id>`, else the one on
    now or next - defaultMeetingId) renders TeacherMeeting: its attendance to
    confirm or correct, and its materials to add, publish, order and delete.
  - "Penilaian" (`?tab=penilaian`, backend 0bb4598, owner 2026-10-08): the slot's
    assessments (AssessmentsTab); each opens its own page under
    /teacher/courses/:id/penilaian.
  - "Nilai" (`?tab=nilai`, owner 2026-10-11): the class subject's gradebook
    (GradebookTable), a row per student whose assessments open their "Hasil"; above
    it the slot's grade settings (SlotGradeSettings, backend 5d42af6), which the
    teacher may change while the year is open. The
    sidebar's "Buku Nilai" lists the same cards as "Kelas Saya" and opens here.
  - "Progres" (`?tab=progres`): the class's learning progress, per student and per
    material (SubjectProgress, the panel the Principal opens from the timetable).

  The subject and its meetings come from readMyTeaching; a meeting changed here
  (confirmed, said not held) updates in place and drops that cache.
*/

const SECTIONS = ['pertemuan', 'penilaian', 'nilai', 'progres'];
const card = 'bg-white border border-slate-100 rounded-2xl p-5 shadow-sm';

export const TeacherClassSubjectDetail = () => {
  const { classSubjectId } = useParams();
  const { t } = useT();
  const navigate = useNavigate();
  const { showToast } = useOutletContext() ?? {};
  const { membership } = useAuth();
  const zone = useSchoolZone();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  /* The grade settings panel's last read, for the gradebook's KKTP marks and to re-read its final grades after a save. */
  const [gradeSettings, setGradeSettings] = useState(undefined);
  const onGradeSettings = useCallback((settings) => setGradeSettings(settings), []);
  /* Meetings changed on this page, by id, over what was read. */
  const [changedById, setChangedById] = useState({});
  /* The gradebook's grade read, shared with the descriptions card, and that card's
     unsaved typing - kept here so switching tab (a query change the guard lets
     through) loses nothing; a move off the page asks first. */
  const [grades, setGrades] = useState(undefined);
  const onGrades = useCallback((read) => setGrades(read), []);
  const [gradesKey, setGradesKey] = useState(0);
  const [descDrafts, setDescDrafts] = useState({});
  const [draftsFor, setDraftsFor] = useState(classSubjectId);
  if (draftsFor !== classSubjectId) {
    setDraftsFor(classSubjectId);
    setDescDrafts({});
    setGrades(undefined);
  }
  const descDirty = useMemo(
    () => descriptionRows(grades && !grades.failed ? grades : null).some((row) => isChanged(row, descDrafts)),
    [grades, descDrafts]
  );
  const guard = useUnsavedGuard(descDirty);

  useEffect(() => {
    let cancelled = false;
    /* The years too: a subject of a closed year opens read only (owner, 2026-10-05). */
    Promise.all([readMyTeaching(membership?.id, { fresh: attempt > 0 }), academicsService.academicYears()])
      .then(([answer, years]) => {
        if (cancelled) return;
        setData({ ...answer, openSemesters: openSemesterIds(years) });
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [attempt, membership?.id]);

  /* Assessments of this slot waiting to be marked or released, for the "Penilaian"
     tab's amber count (the reviewed mockup, owner 2026-10-28): the dashboard's
     queue, kept a minute and shared with the sidebar. 0 when it cannot be read. */
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    let cancelled = false;
    readTeachingDashboard(membership?.id)
      .then((answer) => !cancelled && setWaiting(waitingInSlot(answer?.queue, classSubjectId)))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [membership?.id, classSubjectId]);

  const entry = data?.rows.find((row) => row.id === classSubjectId) ?? null;
  const live = Boolean(entry && entry.status === 'ACTIVE' && !entry.endedAt);
  /* Its year closed: looked back at, nothing changed (no material, confirmation or "not held"). */
  const readOnly = Boolean(entry && data?.openSemesters && !data.openSemesters.has(entry.semester?.id));
  const raw = data?.sessionsById?.[classSubjectId];
  const sessions = useMemo(
    () =>
      Array.isArray(raw)
        ? shownSessions(raw.map((session) => changedById[session.id] ?? session)).sort((a, b) => a.number - b.number)
        : null,
    [raw, changedById]
  );

  const section = SECTIONS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'pertemuan';
  const asked = searchParams.get('pertemuan');
  const selectedId = sessions ? (sessions.some((session) => session.id === asked) ? asked : defaultMeetingId(sessions)) : null;
  const selected = sessions?.find((session) => session.id === selectedId) ?? null;
  const progress = progressOf(sessions);
  const percent = progress?.total ? Math.round((progress.held / progress.total) * 100) : 0;
  const owed = sessions ? unconfirmedCount(sessions) : 0;

  const pick = (id) => setSearchParams({ pertemuan: id });
  const goSection = (next) => setSearchParams(next === 'pertemuan' ? (selectedId ? { pertemuan: selectedId } : {}) : { tab: next });

  const onChanged = (session) => {
    if (!session) return;
    forgetMyTeaching();
    setChangedById((prev) => ({ ...prev, [session.id]: { ...(prev[session.id] ?? sessions.find((s) => s.id === session.id)), ...session } }));
  };

  if (failed && !data) {
    return (
      <HomeError message={t('teach.failed')} retryLabel={t('att.error.retry')} onRetry={() => setAttempt((n) => n + 1)} />
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

  if (!live) {
    return (
      <EmptyCard icon={BookOpen} title={t(entry ? 'teach.notLive' : 'teach.notFound')} />
    );
  }

  return (
    <div className="space-y-6">
      {guard.dialog}
      {/* No book tile, as on the student's page (the reviewed mockup, owner 2026-10-28). */}
      <SubjectHeader
        tile={false}
        code={entry.subject.code}
        name={entry.subject.name}
        facts={[
          { label: t('person.class'), value: entry.class.name },
          { label: t('classroom.semesters'), value: entry.semester.ordinal },
          { label: t('person.year'), value: entry.semester.academicYear },
          {
            label: t('teach.fact.unconfirmed'),
            value: <span className={owed > 0 ? 'text-amber-700' : 'text-slate-800'}>{sessions ? owed : '-'}</span>,
          },
        ]}
        progress={progress?.total > 0 ? { label: t('classroom.progress', { held: progress.held, total: progress.total }), percent } : null}
      />

      {readOnly && (
        <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-600 leading-relaxed">
          <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
          {t('teach.readOnly', { n: entry.semester.ordinal, year: entry.semester.academicYear })}
        </p>
      )}

      {/* The dashboards' text tabs (the reviewed mockup, owner 2026-10-28): the row swipes
          on a phone, the line under it an inset shadow; "Penilaian" carries an amber count
          of assessments waiting to be marked or released. */}
      <div role="tablist" aria-label={t('meeting.sections')} className="flex gap-0.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-[inset_0_-1px_0_var(--color-slate-100)]">
        {SECTIONS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={section === key}
            onClick={() => goSection(key)}
            className={`shrink-0 whitespace-nowrap px-2.5 py-2 text-sm font-bold border-b-2 transition-colors cursor-pointer focus:outline-none focus-visible:text-brand ${
              section === key ? 'text-brand border-brand' : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            {t(`teach.section.${key}`)}
            {key === 'penilaian' && waiting > 0 && (
              <span className="ml-1.5 px-1.5 rounded-full text-[11px] tabular-nums bg-amber-50 text-amber-700">
                {waiting}
                <span className="sr-only"> {t('teach.waitingCount', { n: waiting })}</span>
              </span>
            )}
          </button>
        ))}
      </div>

      {section === 'penilaian' ? (
        <AssessmentsTab classSubjectId={entry.id} semesterId={entry.semester?.id} readOnly={readOnly} zone={zone} />
      ) : section === 'nilai' ? (
        <div className="space-y-4">
          {/* Finalising (ticket 04, owner 2026-10-18): shown only while the semester is being finalised or once this slot is. */}
          <FinalisingCard
            classSubjectId={entry.id}
            subjectName={entry.subject.name}
            semester={entry.semester}
            grades={grades}
            canEdit={!readOnly}
            zone={zone}
            onChanged={() => setGradesKey((n) => n + 1)}
            onOpenSessions={() => goSection('pertemuan')}
            onOpenAssessments={() => goSection('penilaian')}
            onOpenAssessment={(assessmentId) => navigate(`/teacher/courses/${entry.id}/penilaian/${assessmentId}?tab=hasil`)}
            onToast={showToast}
          />
          {/* A finalised slot (ticket 04, the grade read's `finalised`) takes no settings change until its teacher undoes it. */}
          <SlotGradeSettings classSubjectId={entry.id} canEdit={!readOnly && !grades?.finalised} onToast={showToast} onSettings={onGradeSettings} />
          <GradebookTable
            classSubjectId={entry.id}
            caption={t('gradebook.option', { code: entry.subject.code, className: entry.class.name, n: entry.semester.ordinal, year: entry.semester.academicYear })}
            fileName={`nilai-${entry.subject.code}-${entry.class.name}.csv`.replace(/\s+/g, '-')}
            onOpen={(assessment) => navigate(`/teacher/courses/${entry.id}/penilaian/${assessment.id}?tab=hasil`)}
            onOpenAssessments={() => goSection('penilaian')}
            kktp={gradeSettings?.kktp?.value ?? null}
            settingsStamp={gradeSettings === undefined ? undefined : (gradeSettings.updatedAt ?? null)}
            onGrades={onGrades}
            reloadKey={gradesKey}
          />
          <SlotDescriptions
            classSubjectId={entry.id}
            grades={grades}
            kktp={gradeSettings?.kktp?.value ?? null}
            canEdit={!readOnly}
            drafts={descDrafts}
            onDrafts={setDescDrafts}
            onReload={() => setGradesKey((n) => n + 1)}
            onToast={showToast}
          />
        </div>
      ) : section === 'progres' ? (
        <div className={`${card} sm:p-6`}>
          <SubjectProgress classSubjectId={entry.id} zone={membership?.school?.timeZone ?? null} />
        </div>
      ) : sessions === null ? (
        <p className={`${card} text-sm font-semibold text-amber-700`}>{t('classroom.meetingsFailed')}</p>
      ) : sessions.length === 0 ? (
        <p className={`${card} text-sm font-semibold text-slate-600`}>{t('teach.noTimetable')}</p>
      ) : (
        <div className="space-y-5">
          <MeetingStrip
            sessions={sessions}
            selectedId={selectedId}
            onPick={pick}
            dotOf={(session) => (['running', 'awaiting'].includes(sessionPhase(session)) ? 'bg-amber-400' : null)}
          />
          {selected && <TeacherMeeting key={selected.id} meeting={selected} onChanged={onChanged} showToast={showToast} readOnly={readOnly} />}
        </div>
      )}
    </div>
  );
};

export default TeacherClassSubjectDetail;
