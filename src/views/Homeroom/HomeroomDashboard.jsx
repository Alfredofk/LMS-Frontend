import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronRight, School } from 'lucide-react';

import Button from '../../components/ui/Button';
import EmptyCard from '../../components/ui/EmptyCard';
import FactLine from '../../components/ui/FactLine';
import ClassDetail from '../Classes/components/ClassDetail';
import ClassMovesSection from './ClassMovesSection';
import ClassSummary from './ClassSummary.jsx';
import HomeroomAttendance from './HomeroomAttendance.jsx';
import HomeroomNotes from './HomeroomNotes';
import HomeroomPromotions from './HomeroomPromotions';
import ClassReportCards from '../ReportCards/ClassReportCards';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { pendingMoveByStudent } from './moves';
import { academicsService } from '../../services/academicsService';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { academicsErrorMessage, movesErrorMessage } from '../../i18n/apiError';
import { notifyPendingChanged } from '../../hooks/usePendingCounts';

/*
  The homeroom teacher's own classes — real since backend `36476f3`.

  This page used to ask `/api/homeroom/class` and `/api/homeroom/students`,
  neither of which was ever written, so it rendered NotBuiltYet and the sidebar
  never offered it. Homeroom teaching is not a role: it is a Teacher named on a
  Class (`Class.homeroomTeacherMembershipId`), and `GET /api/academics/classes`
  answers a teacher with exactly the classes they are named on. That is the
  whole source now.

  **Filtered to the reader's own classes anyway.** The same endpoint answers a
  Principal with every class in the school, and a Principal who also teaches can
  be working here as TEACHER — so "mine" is checked against the membership id,
  not assumed from the role.

  Read-only: taking a student out of the school is the Principal's alone since
  backend `89d1fc1`, so the roster offers no removal here. **Moving a student to
  another class is this page's** (ticket 16, owner 2026-09-26): "Move" on each
  roster row, and a "Class moves" section below the classes with what waits for
  this teacher's decision, what they asked for, and the history. Naming or
  changing a homeroom teacher is the Principal's, on /headmaster/classes. What a homeroom teacher *does* with a class today is
  release its students' join requests — which happens on /join-requests, so the
  page points there.

  **"Ringkasan kelas" opens the class** (backend 7ee7857; owner, 2026-10-27):
  ClassSummary, above everything else - each student's attendance, grades against
  each subject's KKTP and Support Signals, those needing attention first.

  **Attendance is read here** (backend deb95e8; owner, 2026-10-02): below the
  opened class, HomeroomAttendance — its subjects, their meetings, each meeting's
  roster. Read only; confirming is the subject teacher's. Under it the report
  card's Notes per semester (HomeroomNotes, backend 483be5a; owner 2026-10-18),
  which this teacher writes, in Semester 2 the Promotion Outcomes
  (HomeroomPromotions, backend 4dae152; owner 2026-10-22), and the class's report
  cards (ClassReportCards); "back to the class list" asks first while either form
  is unsaved. The old page carried a whole report modal built on a guessed
  contract; it went with the guess, and the line saying report cards were not
  built went on 2026-10-28, once they were.
*/
export const HomeroomDashboard = () => {
  const { showToast } = useOutletContext();
  const { membership } = useAuth();
  const navigate = useNavigate();
  const { t } = useT();

  const [classes, setClasses] = useState(null);
  const [error, setError] = useState(null);
  const location = useLocation();
  /* Coming back from a report card reopens its class (ClassReportCards passes it). */
  const [selectedId, setSelectedId] = useState(() => location.state?.classId ?? null);
  const [moves, setMoves] = useState(null);
  const [movesError, setMovesError] = useState(null);
  /* The notes card's unsaved typing, and "back" asked for while it waits. */
  const [notesDirty, setNotesDirty] = useState(false);
  const [promotionsDirty, setPromotionsDirty] = useState(false);
  const [askBack, setAskBack] = useState(false);
  const leaveClass = () => {
    setAskBack(false);
    setNotesDirty(false);
    setPromotionsDirty(false);
    setSelectedId(null);
  };

  useEffect(() => {
    let cancelled = false;
    academicsService
      .classes()
      .then((list) => !cancelled && setClasses(list))
      .catch((err) => !cancelled && setError(academicsErrorMessage(err, t)));
    return () => {
      cancelled = true;
    };
  }, [t]);

  /* Its own request, so a failure here leaves the classes on screen. */
  const loadMoves = useCallback(
    () =>
      academicsService
        .classMoves()
        .then((list) => {
          setMoves(list);
          setMovesError(null);
        })
        .catch((err) => setMovesError(movesErrorMessage(err, t))),
    [t]
  );

  useEffect(() => {
    loadMoves();
  }, [loadMoves]);

  /* After a move is decided the counts on the class list change too. */
  const reloadAfterMove = () => {
    loadMoves();
    notifyPendingChanged();
    academicsService.classes().then(setClasses).catch(() => {});
  };

  const pendingMoves = useMemo(() => pendingMoveByStudent(moves), [moves]);

  /* Open years first — that is where the work is — then closed ones, kept for reading. */
  const mine = (classes ?? [])
    .filter((entry) => entry.homeroomTeacher?.membershipId === membership?.id)
    .sort(
      (a, b) =>
        (a.academicYear?.status === 'ACTIVE' ? 0 : 1) - (b.academicYear?.status === 'ACTIVE' ? 0 : 1) ||
        String(b.academicYear?.label).localeCompare(String(a.academicYear?.label)) ||
        a.gradeLevel - b.gradeLevel ||
        a.name.localeCompare(b.name, 'id')
    );

  /* Open years first, closed ones under their own small heading (owner, 2026-10-28). */
  const live = mine.filter((entry) => entry.academicYear?.status === 'ACTIVE');
  const closed = mine.filter((entry) => entry.academicYear?.status !== 'ACTIVE');
  const students = live.reduce((sum, entry) => sum + (entry.studentCount ?? 0), 0);

  /* School / classes in an open year / their students, one grey line (owner, 2026-10-28,
     the reviewed mockup); it replaced a sentence and the list heading's own count. */
  const title = (
    <div className="select-none">
      <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
        {t('shell.homeroom')}
      </h1>
      <FactLine
        className="mt-2"
        facts={[
          membership?.school?.name ?? membership?.schoolName,
          classes !== null && !error && t('homeroom.subtitle.classes', { n: live.length }),
          classes !== null && !error && t('classes.class.studentCount', { n: students }),
        ]}
      />
    </div>
  );

  const classRows = (list, past = false) =>
    list.length > 0 && (
      <ul className="divide-y divide-slate-100 -mx-2">
        {list.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => setSelectedId(entry.id)}
              className="group w-full px-2 py-3 flex items-center justify-between gap-3 text-left rounded-xl hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <span className="min-w-0">
                <span className={`block text-sm font-extrabold break-words ${past ? 'text-slate-600' : 'text-slate-800'}`}>{entry.name}</span>
                <FactLine
                  className="mt-0.5"
                  wrap
                  facts={[
                    t('classes.grade', { n: entry.gradeLevel }),
                    entry.academicYear?.label,
                    t('classes.class.studentCount', { n: entry.studentCount ?? 0 }),
                  ]}
                />
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    );

  const selectedYearId = (classes ?? []).find((entry) => entry.id === selectedId)?.academicYear?.id ?? null;

  if (selectedId) {
    return (
      <div className="space-y-6">
        {title}
        <ClassDetail
          classId={selectedId}
          /* The class at a glance, under its own card (owner, 2026-10-27; backend 7ee7857). */
          summary={<ClassSummary key={`sum-${selectedId}`} classId={selectedId} />}
          readOnly
          canMove
          pendingMoves={pendingMoves}
          onMoveRequested={reloadAfterMove}
          onBack={() => (notesDirty || promotionsDirty ? setAskBack(true) : leaveClass())}
          onChanged={(updated) =>
            setClasses((prev) =>
              (prev ?? []).map((entry) =>
                entry.id === updated?.id ? { ...entry, studentCount: updated.studentCount } : entry
              )
            )
          }
          showToast={showToast}
        />
        {selectedYearId && <HomeroomAttendance key={selectedId} classId={selectedId} academicYearId={selectedYearId} />}
        {selectedYearId && (
          <HomeroomNotes key={`notes-${selectedId}`} classId={selectedId} academicYearId={selectedYearId} canEdit onDirty={setNotesDirty} onToast={showToast} />
        )}
        {selectedYearId && (
          <HomeroomPromotions
            key={`promo-${selectedId}`}
            classId={selectedId}
            academicYearId={selectedYearId}
            canEdit
            onDirty={setPromotionsDirty}
            onToast={showToast}
          />
        )}
        {selectedYearId && (
          <ClassReportCards
            key={`rc-${selectedId}`}
            classId={selectedId}
            academicYearId={selectedYearId}
            initialSemesterId={location.state?.classId === selectedId ? (location.state?.semesterId ?? null) : null}
          />
        )}
        <ConfirmDialog
          open={askBack}
          tone="danger"
          title={t('unsaved.title')}
          body={t('unsaved.body')}
          confirmLabel={t('unsaved.leave')}
          cancelLabel={t('unsaved.stay')}
          onConfirm={leaveClass}
          onCancel={() => setAskBack(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {title}

      {error ? (
        <div className="rounded-xl bg-rose-50 p-3.5 text-[13px] text-rose-700 font-semibold" role="alert">
          {error}
        </div>
      ) : classes === null ? (
        <div className="space-y-4" aria-label={t('common.loading')}>
          <div className="h-24 bg-white border border-slate-100 rounded-2xl animate-pulse" />
          <div className="h-40 bg-white border border-slate-100 rounded-2xl animate-pulse" />
        </div>
      ) : mine.length === 0 ? (
        <EmptyCard icon={School} title={t('homeroom.none.title')} body={t('homeroom.none.body')} />
      ) : (
        <>
          {/* A class is its name over one grey line (grade / year / students), as on
              /headmaster/classes; the chips went (owner, 2026-10-28). */}
          <section className="bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm space-y-3">
            <h2 className="text-base font-extrabold text-slate-900">{t('homeroom.list.heading')}</h2>
            {classRows(live)}
            {closed.length > 0 && (
              <>
                <h3 className="pt-3 text-[13px] font-extrabold text-slate-600">{t('homeroom.list.closed')}</h3>
                {classRows(closed, true)}
              </>
            )}
          </section>

          <ClassMovesSection
            moves={moves}
            error={movesError}
            mineIds={new Set(mine.map((entry) => entry.id))}
            onChanged={reloadAfterMove}
            showToast={showToast}
          />

          {/* What a homeroom teacher actually does here today: let students in. */}
          <section className="bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-slate-900">{t('homeroom.requests.title')}</h2>
              <p className="text-[13px] text-slate-500 leading-relaxed mt-0.5">{t('homeroom.requests.body')}</p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => navigate('/join-requests')}>
              {t('shell.joinRequests')}
            </Button>
          </section>

        </>
      )}
    </div>
  );
};

export default HomeroomDashboard;
