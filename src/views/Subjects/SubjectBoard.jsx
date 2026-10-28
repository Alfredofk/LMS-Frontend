import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, Pencil, Plus, School } from 'lucide-react';

import SelectField from '../../components/ui/SelectField';
import Button from '../../components/ui/Button';
import FactLine from '../../components/ui/FactLine';
import EmptyCard from '../../components/ui/EmptyCard';
import SemesterSegments from './SemesterSegments';
import AssignTeacherDialog from './AssignTeacherDialog';
import ChangeAssignmentDialog from './ChangeAssignmentDialog';
import { academicsService } from '../../services/academicsService';
import { useT } from '../../i18n/LanguageContext';
import { subjectsErrorMessage } from '../../i18n/apiError';
import { formatDay } from '../Classes/format';
import SubjectLabel from '../../components/ui/SubjectLabel';
import { defaultSlot, defaultSemesterOf, freeSubjects, boardWritable, boardAssignable, replaceOnly, deadlinePassed, canChangeAssignment } from './subjects';

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

  **"Change"** on an ACTIVE row ends it or hands it to another teacher while
  its teacher stays (backend 85bc687; ChangeAssignmentDialog). Offered where
  "assign" is, and never to a Vice Principal on their own row (`selfId`).
*/
export const SubjectBoard = ({ years, catalog, teachers, loadTeachers, showToast, selfId = null, onChanged: onBoardChanged = () => {} }) => {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const usable = years ?? [];

  const [slot, setSlot] = useState(() => defaultSlot(years, today));
  /* The last answer, and which semester it is about: a different one on screen
     means it is still loading — derived, so nothing is cleared in an effect. */
  const [answer, setAnswer] = useState({ semesterId: null, board: null, error: null });
  const [assigning, setAssigning] = useState(null);
  /* { row, boardClass } — the ACTIVE assignment being ended or replaced. */
  const [changing, setChanging] = useState(null);

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
    <EmptyCard
      icon={CalendarClock}
      title={year ? t('subjects.board.noSemester.titleOf', { label: year.label }) : t('subjects.board.noSemester.title')}
      body={t('subjects.board.noSemester.body')}
      action={
        <Button size="sm" onClick={() => navigate('/headmaster/classes')}>
          {t('subjects.board.noSemester.go')}
        </Button>
      }
    />
  );

  if (!slot) return noSemester;

  const semester = board?.semester;
  const writable = semester && boardWritable(year?.status, semester.status);
  /* A FINALIZING semester still takes the leaders' override and replace (backend eadf680). */
  const assignable = semester && boardAssignable(year?.status, semester.status);
  const finalizing = Boolean(assignable && !writable);
  const deadline = semester?.classSubjectRegistrationDeadline;

  const openAssign = (boardClass) => {
    loadTeachers();
    setAssigning(boardClass);
  };

  const openChange = (row, boardClass) => {
    loadTeachers();
    setChanging({ row, boardClass });
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
          <SemesterSegments
            id="board-semester-label"
            semesters={year.semesters}
            value={slot.semesterId}
            onChange={(id) => setSlot({ yearId: slot.yearId, semesterId: id })}
          />
        )}
      </div>

      {!semesterId && noSemester}

      {semester && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600 leading-relaxed space-y-1">
          {/* A closed year or semester takes nothing, so its deadline says
              nothing useful — "teachers can ask any time" beside "closed" read
              as a contradiction. Only the read-only line is shown then. */}
          {finalizing ? (
            <p>{t('subjects.board.finalizing')}</p>
          ) : writable ? (
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
        <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 p-3.5 text-[13px] font-semibold text-rose-700" role="alert">
          {error}
        </div>
      ) : board === null ? (
        <div className="h-48 bg-white border border-slate-100 rounded-2xl animate-pulse" aria-label={t('common.loading')} />
      ) : board.classes.length === 0 ? (
        <EmptyCard icon={School} title={t('subjects.board.noClasses')} />
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {board.classes.map((entry) => (
            <li key={entry.id} className="bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm space-y-3 min-w-0">
              <div className="flex items-start justify-between gap-3">
                {/* The grade as part of one grey line, not a chip (owner, 2026-10-28). */}
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight break-words">{entry.name}</h3>
                  <FactLine
                    size="xs"
                    wrap
                    className="mt-0.5"
                    facts={[
                      t('classes.grade', { n: entry.gradeLevel }),
                      t('subjects.board.homeroom', { name: entry.homeroomTeacher?.fullName ?? t('classes.detail.noHomeroom') }),
                    ]}
                  />
                </div>
                {assignable && (
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
                          <SubjectLabel code={row.subject.code} name={row.subject.name} />
                        </span>
                        <span className="block text-[11px] font-semibold text-slate-500 break-words">{row.teacher.fullName}</span>
                      </span>
                      {row.status === 'PENDING' && (
                        <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800">
                          {t('subjects.status.PENDING')}
                        </span>
                      )}
                      {assignable && canChangeAssignment(row, selfId) && (
                        <button
                          type="button"
                          onClick={() => openChange(row, entry)}
                          aria-label={t('subjects.board.changeLabel', { subject: row.subject.name, className: entry.name })}
                          className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-extrabold text-slate-600 hover:text-brand hover:bg-brand-tint transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          {t('subjects.board.change')}
                        </button>
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
            onBoardChanged();
          }}
        />
      )}

      {changing && semester && (
        <ChangeAssignmentDialog
          key={changing.row.classSubjectId}
          row={changing.row}
          boardClass={changing.boardClass}
          semester={semester}
          teachers={teachers}
          replaceOnly={replaceOnly(semester.status)}
          onClose={() => setChanging(null)}
          onChanged={(message) => {
            setChanging(null);
            showToast(message, 'success');
            load();
            onBoardChanged();
          }}
          onStale={(message) => {
            setChanging(null);
            showToast(message, 'error');
            load();
          }}
        />
      )}
    </div>
  );
};

export default SubjectBoard;
