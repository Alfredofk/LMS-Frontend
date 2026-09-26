import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, Plus, School } from 'lucide-react';

import SelectField from '../../components/ui/SelectField';
import AssignTeacherDialog from './AssignTeacherDialog';
import { academicsService } from '../../services/academicsService';
import { useT } from '../../i18n/LanguageContext';
import { subjectsErrorMessage } from '../../i18n/apiError';
import { formatDay } from '../Classes/format';
import { defaultSlot, defaultSemesterOf, freeSubjects, boardWritable, deadlinePassed } from './subjects';

/*
  Who teaches what, class by class, in one semester —
  `GET /academics/semesters/:id/class-subjects`, which answers PENDING and
  ACTIVE assignments (a waiting one is marked). It opens on the active year's
  current semester (`defaultSlot`), and every year is in the picker.

  **A year with no semester yet is shown, not skipped.** It used to be left out
  of the picker, so a school whose active year had no semester opened on a
  closed year and the active one seemed to be missing (owner, 2026-09-26). Now
  it opens on the active year and says to create a semester, with a button to
  the Classes page, where that is done.

  **"Assign a teacher"** is the Principal's direct path (override): ACTIVE at
  once, and the only way in once the teachers' deadline has passed. It is not
  offered for a closed year or a semester that is not OPEN — the backend refuses
  both. The deadline is shown, because it decides whether teachers can still
  ask for themselves.
*/
export const SubjectBoard = ({ years, catalog, teachers, loadTeachers, showToast }) => {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const usable = years ?? [];

  const [slot, setSlot] = useState(() => defaultSlot(years, today));
  /* The last answer, and which semester it is about: a different one on screen
     means it is still loading — derived, so nothing is cleared in an effect. */
  const [answer, setAnswer] = useState({ semesterId: null, board: null, error: null });
  const [assigning, setAssigning] = useState(null);

  const year = usable.find((entry) => entry.id === slot?.yearId) ?? null;
  const semesterId = slot?.semesterId ?? null;

  const load = useCallback(() => {
    if (!semesterId) return;
    academicsService
      .subjectBoard(semesterId)
      .then((board) => setAnswer({ semesterId, board, error: null }))
      .catch((err) => setAnswer({ semesterId, board: null, error: subjectsErrorMessage(err, t) }));
  }, [semesterId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const current = answer.semesterId === semesterId;
  const board = current ? answer.board : null;
  const error = current ? answer.error : null;

  /* No year at all, or the chosen one has no semester yet. */
  const noSemester = (
    <div className="py-14 px-6 text-center border border-dashed border-slate-200 rounded-2xl bg-white">
      <CalendarClock className="w-9 h-9 text-slate-300 mx-auto" aria-hidden="true" />
      <h2 className="mt-2.5 text-sm font-extrabold text-slate-700">
        {year ? t('subjects.board.noSemester.titleOf', { label: year.label }) : t('subjects.board.noSemester.title')}
      </h2>
      <p className="mt-1.5 text-xs font-semibold text-slate-500 leading-relaxed max-w-sm mx-auto">
        {t('subjects.board.noSemester.body')}
      </p>
      <button
        type="button"
        onClick={() => navigate('/headmaster/classes')}
        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand hover:bg-brand-deep text-white text-xs font-extrabold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        <School className="w-4 h-4" aria-hidden="true" />
        {t('subjects.board.noSemester.go')}
      </button>
    </div>
  );

  if (!slot) return noSemester;

  const semester = board?.semester;
  const writable = semester && boardWritable(year?.status, semester.status);
  const deadline = semester?.classSubjectRegistrationDeadline;

  const openAssign = (boardClass) => {
    loadTeachers();
    setAssigning(boardClass);
  };

  return (
    <div className="space-y-4">
      {/* Two columns that line up: each has a label, and the semester buttons
          are the select's height (same padding, same text size). */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="sm:w-64">
          <SelectField
            id="board-year"
            label={t('subjects.board.year')}
            value={slot.yearId}
            onChange={(e) => {
              const next = usable.find((entry) => entry.id === e.target.value);
              setSlot({ yearId: next.id, semesterId: defaultSemesterOf(next, today) });
            }}
          >
            {usable.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {t('subjects.board.yearOption', {
                  label: entry.label,
                  status: t(`subjects.board.yearStatus.${entry.status}`),
                })}
              </option>
            ))}
          </SelectField>
        </div>
        {(year?.semesters ?? []).length > 0 && (
        <div className="flex flex-col gap-1.5">
        <span id="board-semester-label" className="text-sm font-semibold text-slate-700 select-none">
          {t('subjects.board.semester')}
        </span>
        <div className="flex gap-2" role="group" aria-labelledby="board-semester-label">
          {(year?.semesters ?? []).map((entry) => {
            const active = entry.id === slot.semesterId;
            return (
              <button
                key={entry.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSlot({ yearId: slot.yearId, semesterId: entry.id })}
                className={`px-5 py-2.5 md:py-3 rounded-xl text-base font-bold border transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  active ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {t('classes.semester.name', { n: entry.ordinal })}
              </button>
            );
          })}
        </div>
        </div>
        )}
      </div>

      {!semesterId && noSemester}

      {semester && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600 leading-relaxed space-y-1">
          {/* A closed year or semester takes nothing, so its deadline says
              nothing useful — "teachers can ask any time" beside "closed" read
              as a contradiction. Only the read-only line is shown then. */}
          {writable ? (
            <p>
              {deadline
                ? t(deadlinePassed(semester) ? 'subjects.board.deadlinePassed' : 'subjects.board.deadline', {
                    date: formatDay(deadline, lang),
                  })
                : t('subjects.board.noDeadline')}
            </p>
          ) : (
            <p className="text-slate-500">{t('subjects.board.readOnly')}</p>
          )}
        </div>
      )}

      {!semesterId ? null : error ? (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : board === null ? (
        <div className="h-48 bg-white border border-slate-100 rounded-2xl animate-pulse" aria-label={t('common.loading')} />
      ) : board.classes.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-slate-200 rounded-2xl bg-white">
          <School className="w-9 h-9 text-slate-300 mx-auto" aria-hidden="true" />
          <p className="mt-2.5 text-xs font-extrabold text-slate-500">{t('subjects.board.noClasses')}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {board.classes.map((entry) => (
            <li key={entry.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-extrabold text-slate-800 break-words">{entry.name}</h3>
                    <span className="px-2 py-0.5 bg-brand-tint text-brand text-[10px] font-extrabold rounded-md">
                      {t('classes.grade', { n: entry.gradeLevel })}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                    {t('subjects.board.homeroom', { name: entry.homeroomTeacher?.fullName ?? t('classes.detail.noHomeroom') })}
                  </p>
                </div>
                {writable && (
                  <button
                    type="button"
                    onClick={() => openAssign(entry)}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold text-brand hover:bg-brand-tint transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    {t('subjects.board.assign')}
                  </button>
                )}
              </div>

              {entry.subjects.length === 0 ? (
                <p className="text-xs font-semibold text-slate-500">{t('subjects.board.empty')}</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {entry.subjects.map((row) => (
                    <li key={row.classSubjectId} className="py-2 flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-slate-800 break-words">
                          <span className="tabular-nums text-slate-500">{row.subject.code}</span> · {row.subject.name}
                        </span>
                        <span className="block text-[11px] font-semibold text-slate-500 break-words">{row.teacher.fullName}</span>
                      </span>
                      {row.status === 'PENDING' && (
                        <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800">
                          {t('subjects.status.PENDING')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {assigning && semester && (
        <AssignTeacherDialog
          key={assigning.id}
          boardClass={assigning}
          semester={semester}
          subjects={freeSubjects(catalog, assigning)}
          teachers={teachers}
          onClose={() => setAssigning(null)}
          onAssigned={(assigned) => {
            setAssigning(null);
            showToast(
              t('subjects.assign.done', {
                teacher: assigned?.teacher?.fullName ?? '',
                subject: assigned?.subject?.name ?? '',
                className: assigned?.class?.name ?? '',
              }),
              'success'
            );
            load();
          }}
        />
      )}
    </div>
  );
};

export default SubjectBoard;
