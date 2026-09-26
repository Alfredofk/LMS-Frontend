import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronRight, Inbox, School, Users, NotebookPen } from 'lucide-react';

import Button from '../../components/ui/Button';
import ClassDetail from '../Classes/components/ClassDetail';
import ClassMovesSection from './ClassMovesSection';
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

  Reports, grades and attendance are not here: no model for any of them exists
  in the backend. The old page carried a whole report modal built on a guessed
  contract; it went with the guess. The notice says it is coming rather than
  leaving a gap nobody explains.
*/
export const HomeroomDashboard = () => {
  const { showToast } = useOutletContext();
  const { membership } = useAuth();
  const navigate = useNavigate();
  const { t } = useT();

  const [classes, setClasses] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [moves, setMoves] = useState(null);
  const [movesError, setMovesError] = useState(null);

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

  const students = mine
    .filter((entry) => entry.academicYear?.status === 'ACTIVE')
    .reduce((sum, entry) => sum + (entry.studentCount ?? 0), 0);

  const title = (
    <div className="select-none">
      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
        {t('shell.homeroom')}
      </h1>
      <p className="text-xs sm:text-sm text-slate-500 font-bold mt-1">{t('homeroom.subtitle')}</p>
    </div>
  );

  if (selectedId) {
    return (
      <div className="space-y-6">
        {title}
        <ClassDetail
          classId={selectedId}
          readOnly
          canMove
          pendingMoves={pendingMoves}
          onMoveRequested={reloadAfterMove}
          onBack={() => setSelectedId(null)}
          onChanged={(updated) =>
            setClasses((prev) =>
              (prev ?? []).map((entry) =>
                entry.id === updated?.id ? { ...entry, studentCount: updated.studentCount } : entry
              )
            )
          }
          showToast={showToast}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {title}

      {error ? (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : classes === null ? (
        <div className="space-y-4" aria-label={t('common.loading')}>
          <div className="h-24 bg-white border border-slate-100 rounded-2xl animate-pulse" />
          <div className="h-40 bg-white border border-slate-100 rounded-2xl animate-pulse" />
        </div>
      ) : mine.length === 0 ? (
        <div className="py-16 px-6 text-center border border-dashed border-slate-200 rounded-2xl bg-white">
          <School className="w-9 h-9 text-slate-300 mx-auto" aria-hidden="true" />
          <h2 className="mt-2.5 text-sm font-extrabold text-slate-700">{t('homeroom.none.title')}</h2>
          <p className="mt-1.5 text-xs font-semibold text-slate-500 leading-relaxed max-w-sm mx-auto">
            {t('homeroom.none.body')}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-brand-tint text-brand flex items-center justify-center shrink-0">
                <School className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{mine.length}</p>
                <p className="text-xs font-semibold text-slate-500">{t('homeroom.stat.classes')}</p>
              </div>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-brand-tint text-brand flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{students}</p>
                <p className="text-xs font-semibold text-slate-500">{t('homeroom.stat.students')}</p>
              </div>
            </div>
          </div>

          <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-slate-500">
              <School className="w-4 h-4 shrink-0" aria-hidden="true" />
              <h2 className="text-[11px] font-bold uppercase tracking-wider">{t('homeroom.list.heading')}</h2>
            </div>
            <ul className="divide-y divide-slate-100 -mx-2">
              {mine.map((entry) => {
                const open = entry.academicYear?.status === 'ACTIVE';
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(entry.id)}
                      className="w-full px-2 py-3 flex items-center justify-between gap-3 text-left rounded-xl hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-extrabold text-slate-800 break-words">{entry.name}</span>
                          <span className="px-2 py-0.5 bg-brand-tint text-brand text-[10px] font-extrabold rounded-md">
                            {t('classes.grade', { n: entry.gradeLevel })}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md ${
                              open ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {entry.academicYear?.label} · {t(`classes.year.status.${open ? 'ACTIVE' : 'CLOSED'}`)}
                          </span>
                        </span>
                        <span className="block text-[11px] font-semibold text-slate-500 mt-0.5">
                          {t('classes.class.studentCount', { n: entry.studentCount ?? 0 })}
                        </span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <ClassMovesSection
            moves={moves}
            error={movesError}
            mineIds={new Set(mine.map((entry) => entry.id))}
            onChanged={reloadAfterMove}
            showToast={showToast}
          />

          {/* What a homeroom teacher actually does here today: let students in. */}
          <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <Inbox className="w-5 h-5 text-brand shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-800">{t('homeroom.requests.title')}</p>
                <p className="text-xs font-semibold text-slate-500 leading-relaxed mt-0.5">
                  {t('homeroom.requests.body')}
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => navigate('/join-requests')}>
              {t('shell.joinRequests')}
            </Button>
          </section>

          <p className="flex items-start gap-2 text-[11px] font-semibold text-slate-500 leading-relaxed">
            <NotebookPen className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
            {t('homeroom.reportsLater')}
          </p>
        </>
      )}
    </div>
  );
};

export default HomeroomDashboard;
