import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRightLeft, ChevronRight, Clock, Pencil, Search, Trash2, UserMinus } from 'lucide-react';

import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import SelectField from '../../../components/ui/SelectField';
import RemoveMemberDialog from '../../../components/RemoveMemberDialog';
import PersonDetailDialog from '../../../components/PersonDetailDialog';
import { foldText, initialsOf } from '../../../utils/names';
import MoveStudentDialog from '../../Homeroom/MoveStudentDialog';
import { ClassEditForm } from './ClassForm';
import { academicsService } from '../../../services/academicsService';
import { useT } from '../../../i18n/LanguageContext';
import { academicsErrorMessage } from '../../../i18n/apiError';
import { formatDay } from '../format';

/*
  One class: who holds it, and who is in it.

  The roster is `GET /academics/classes/:id` — current placements only, nobody
  who has left. A new class is empty, and that is not a fault: a student enters
  a class when its homeroom teacher releases their join request and names this
  class on /join-requests. The empty state says that rather than looking like a
  failed load.

  **Changing the homeroom teacher moves nothing else.** `reviewerScope` reads
  `Class.homeroomTeacherMembershipId` on every request, so the class's waiting
  student and guardian requests are in the new teacher's queue on their next
  read. The confirm dialog says so, because "what happens to the requests?" is
  the obvious worry.

  A closed year's class is read-only: the backend refuses the change with a 409,
  so the control is not offered.

  **The Principal can take a student out from the roster** — `POST
  /api/members/:id/remove`. Only the Principal since backend `89d1fc1` (owner,
  2026-09-24): a homeroom teacher who released a student into the wrong class
  moves them instead (ticket 16), so on the homeroom teacher's page (`readOnly`)
  the button is not rendered — the backend would answer it 403. `membershipId`
  on each roster row is exactly what that route takes. The row leaves the roster at once, and `onChanged` hears the
  smaller count so the list behind this page does not keep the old number.

  `readOnly` is for the homeroom teacher's own page (/teacher/homeroom): they see
  the same class and roster, and the change-homeroom control is not rendered —
  the list of teachers behind it answers a teacher 403.

  **There, each student can be moved to another class** (`canMove`, ticket 16)
  while the year is open. A student with a move already waiting shows where to,
  instead of a second "Move" the server would refuse. `pendingMoves` is that
  map (moves.js `pendingMoveByStudent`), and `onMoveRequested` tells the page
  to re-read its moves — and its classes, when the move happened at once.

  **The Principal can correct or delete the class** (backend `f669286`), in an
  ACTIVE year and never on the `readOnly` page: name and grade through
  `ClassEditForm`, the grade only while it has never held a student. Delete is
  offered only while nobody sits in it; a class that has ever held a student,
  a teaching assignment or a class move is refused by the server, and that
  refusal is said (`classes.error.classNotEmpty`). `onDeleted` hands the page
  the class that went.
*/
export const ClassDetail = ({
  classId,
  onBack,
  onChanged,
  showToast,
  readOnly = false,
  /* Removing a student from the school is the Principal's alone — not a Vice
     Principal's, who otherwise runs this page (ticket 19). */
  canRemove = !readOnly,
  canMove = false,
  pendingMoves = null,
  onMoveRequested,
  grades = [],
  onDeleted,
}) => {
  const { t, lang } = useT();

  const [target, setTarget] = useState(null);
  const [error, setError] = useState(null);
  const [teachers, setTeachers] = useState(null);
  const [isChanging, setIsChanging] = useState(false);
  const [choice, setChoice] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [moving, setMoving] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  /* The roster row opened in PersonDetailDialog, and the search over the roster (owner, 2026-10-03). */
  const [viewing, setViewing] = useState(null);
  const [rosterQuery, setRosterQuery] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      setTarget(await academicsService.getClass(classId));
    } catch (err) {
      setError(academicsErrorMessage(err, t));
    }
  }, [classId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const openChange = async () => {
    setIsChanging(true);
    setSaveError(null);
    setChoice('');
    if (teachers) return;
    try {
      setTeachers(await academicsService.teachers());
    } catch (err) {
      setSaveError(academicsErrorMessage(err, t));
    }
  };

  const chosen = teachers?.find((teacher) => teacher.membershipId === choice) ?? null;

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await academicsService.changeHomeroom(classId, choice);
      /* The answer is the class without its roster; keep the roster we hold. */
      setTarget((prev) => ({ ...prev, ...updated, students: prev?.students ?? [] }));
      setIsChanging(false);
      onChanged(updated);
      showToast(t('classes.detail.homeroom.done', { name: updated?.homeroomTeacher?.fullName ?? '' }), 'success');
    } catch (err) {
      setSaveError(academicsErrorMessage(err, t));
    } finally {
      setIsSaving(false);
      setConfirming(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await academicsService.deleteClass(classId);
      setDeleting(false);
      onDeleted?.(target);
    } catch (err) {
      setDeleting(false);
      setDeleteError(academicsErrorMessage(err, t));
    } finally {
      setIsDeleting(false);
    }
  };

  const back = (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand font-bold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
    >
      <ArrowLeft className="w-4 h-4" aria-hidden="true" />
      {t('classes.detail.back')}
    </button>
  );

  if (error) {
    return (
      <div className="space-y-4">
        {back}
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl text-sm text-red-700" role="alert">
          {error}
        </div>
      </div>
    );
  }

  if (!target) {
    return (
      <div className="space-y-4">
        {back}
        <div className="h-64 bg-white border border-slate-100 rounded-2xl animate-pulse" aria-label={t('common.loading')} />
      </div>
    );
  }

  const open = target.academicYear?.status === 'ACTIVE';
  const students = target.students ?? [];
  const shownStudents = rosterQuery.trim()
    ? students.filter((student) => [student.fullName, student.nisn].some((value) => foldText(value).includes(foldText(rosterQuery))))
    : students;
  const candidates = (teachers ?? []).filter(
    (teacher) => teacher.membershipId !== target.homeroomTeacher?.membershipId
  );

  return (
    <div className="space-y-4">
      {back}

      <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight break-words">{target.name}</h2>
            <span className="px-2 py-0.5 bg-brand-tint text-brand text-[10px] font-extrabold rounded-md">
              {t('classes.grade', { n: target.gradeLevel })}
            </span>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-extrabold rounded-md">
              {target.academicYear?.label}
            </span>
          </div>
          {open && !readOnly && !isEditing && (
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => { setIsEditing(true); setDeleteError(null); }}>
                <Pencil className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                {t('classes.class.edit.open')}
              </Button>
              {students.length === 0 && (
                <Button size="sm" variant="outline" onClick={() => { setDeleting(true); setDeleteError(null); }}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                  {t('classes.class.delete.open')}
                </Button>
              )}
            </div>
          )}
        </div>

        {deleteError && (
          <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
            {deleteError}
          </div>
        )}

        {isEditing && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <ClassEditForm
              target={target}
              grades={grades}
              onCancel={() => setIsEditing(false)}
              onSaved={(updated) => {
                /* The answer is the class without its roster; keep the roster we hold. */
                setTarget((prev) => ({ ...prev, ...updated, students: prev?.students ?? [] }));
                setIsEditing(false);
                onChanged(updated);
                showToast(t('classes.class.edit.done', { name: updated?.name ?? '' }), 'success');
              }}
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {t('classes.class.field.homeroom')}
            </p>
            <p className="text-sm font-extrabold text-slate-800 mt-0.5">
              {target.homeroomTeacher?.fullName ?? t('classes.detail.noHomeroom')}
            </p>
          </div>
          {open && !readOnly && !isChanging && (
            <Button size="sm" variant="outline" className="shrink-0" onClick={openChange}>
              {t('classes.detail.homeroom.change')}
            </Button>
          )}
        </div>

        {isChanging && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            {teachers === null && !saveError ? (
              <div className="h-12 bg-white rounded-xl animate-pulse" aria-label={t('common.loading')} />
            ) : candidates.length === 0 && teachers ? (
              <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                {t('classes.detail.homeroom.noOthers')}
              </p>
            ) : teachers ? (
              <SelectField
                id="newHomeroom"
                label={t('classes.detail.homeroom.new')}
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
              >
                <option value="">{t('classes.class.field.homeroomPlaceholder')}</option>
                {candidates.map((teacher) => (
                  <option key={teacher.membershipId} value={teacher.membershipId}>
                    {teacher.fullName}
                  </option>
                ))}
              </SelectField>
            ) : null}

            {saveError && (
              <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
                {saveError}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <Button size="sm" variant="outline" onClick={() => setIsChanging(false)}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" isDisabled={!chosen} onClick={() => setConfirming(true)}>
                {t('classes.detail.homeroom.save')}
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
        <h3 className="text-base font-extrabold text-slate-900">
          {t('classes.detail.students', { n: students.length })}
        </h3>

        {students.length > 1 && (
          <div className="relative mt-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={rosterQuery}
              onChange={(e) => setRosterQuery(e.target.value)}
              placeholder={t('classes.detail.search')}
              aria-label={t('classes.detail.search')}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </div>
        )}

        {students.length === 0 ? (
          <p className="mt-3 text-xs font-semibold text-slate-500 leading-relaxed">
            {t('classes.detail.noStudents')}
          </p>
        ) : shownStudents.length === 0 ? (
          <p className="mt-4 py-6 text-center text-xs font-extrabold text-slate-500 border border-dashed border-slate-200 rounded-2xl">
            {t('classes.detail.noMatch')}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {shownStudents.map((student) => (
              <li key={student.studentProfileId} className="py-2 flex items-center justify-between gap-2">
                {/* The row opens what the school knows about the student. */}
                <button
                  type="button"
                  onClick={() => setViewing(student)}
                  aria-label={t('classes.detail.openStudent', { name: student.fullName })}
                  className="group min-w-0 flex-1 flex items-center gap-3 text-left rounded-xl px-2 py-1.5 -mx-2 hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className="w-9 h-9 rounded-xl bg-brand-tint text-brand text-xs font-extrabold flex items-center justify-center shrink-0 select-none">
                    {initialsOf(student.fullName)}
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block text-sm font-bold text-slate-800 break-words group-hover:text-brand transition-colors">
                      {student.fullName}
                    </span>
                    <span className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 text-xs font-medium text-slate-500 tabular-nums">
                      <span>{`${t('profile.nisn')} ${student.nisn ?? '-'}`}</span>
                      <span>{t('classes.detail.since', { date: formatDay(student.placedAt, lang) })}</span>
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                </button>
                {canMove && open && (
                  pendingMoves?.get(student.studentProfileId) ? (
                    <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold text-amber-800 bg-amber-50">
                      <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                      {t('moves.roster.waiting', { to: pendingMoves.get(student.studentProfileId).toClass.name })}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setMoving(student)}
                      aria-label={t('moves.roster.moveNamed', { name: student.fullName })}
                      title={t('moves.roster.move')}
                      className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold text-brand hover:bg-brand-tint transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <ArrowRightLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span className="hidden sm:inline">{t('moves.roster.move')}</span>
                    </button>
                  )
                )}
                {canRemove && (
                <button
                  type="button"
                  onClick={() => setRemoving({ membershipId: student.membershipId, fullName: student.fullName })}
                  aria-label={t('members.removeNamed', { name: student.fullName })}
                  title={t('members.remove')}
                  className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  <UserMinus className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="hidden sm:inline">{t('members.remove')}</span>
                </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {viewing && (
      <PersonDetailDialog
        key={viewing.membershipId}
        person={viewing && { membershipId: viewing.membershipId, fullName: viewing.fullName, nisn: viewing.nisn, roles: ['STUDENT'] }}
        placement={
          viewing && target
            ? {
                className: target.name,
                gradeLevel: target.gradeLevel,
                academicYear: target.academicYear?.label ?? '',
                homeroomName: target.homeroomTeacher?.fullName ?? null,
                placedAt: viewing.placedAt,
              }
            : undefined
        }
        onClose={() => setViewing(null)}
      />
      )}

      {moving && (
        <MoveStudentDialog
          key={moving.studentProfileId}
          student={moving}
          fromClass={target}
          onClose={() => setMoving(null)}
          onRequested={(move) => {
            setMoving(null);
            if (move?.status === 'ACTIVE') {
              /* Both classes were the reader's: the student has already gone. */
              const remaining = students.filter((entry) => entry.studentProfileId !== moving.studentProfileId);
              setTarget((prev) => ({ ...prev, students: remaining, studentCount: remaining.length }));
              onChanged({ ...target, students: undefined, studentCount: remaining.length });
              showToast(t('moves.request.moved', { name: moving.fullName, to: move.toClass.name }), 'success');
            } else {
              showToast(t('moves.request.sent', { name: moving.fullName, to: move?.toClass?.name ?? '' }), 'success');
            }
            onMoveRequested?.(move);
          }}
        />
      )}

      {removing && (
        <RemoveMemberDialog
          key={removing.membershipId}
          member={removing}
          onClose={() => setRemoving(null)}
          onRemoved={(member) => {
            setRemoving(null);
            const remaining = students.filter((entry) => entry.membershipId !== member.membershipId);
            setTarget((prev) => ({ ...prev, students: remaining, studentCount: remaining.length }));
            onChanged({ ...target, students: undefined, studentCount: remaining.length });
            showToast(t('members.remove.done', { name: member.fullName }), 'success');
          }}
        />
      )}

      <ConfirmDialog
        open={deleting}
        tone="danger"
        title={t('classes.class.delete.title', { name: target.name })}
        body={t('classes.class.delete.body')}
        confirmLabel={t('classes.class.delete.open')}
        cancelLabel={t('common.cancel')}
        busy={isDeleting}
        busyLabel={t('common.loading')}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(false)}
      />

      <ConfirmDialog
        open={confirming}
        tone="brand"
        title={t('classes.detail.homeroom.confirmTitle')}
        body={t('classes.detail.homeroom.confirmBody', {
          className: target.name,
          name: chosen?.fullName ?? '',
        })}
        confirmLabel={t('classes.detail.homeroom.save')}
        cancelLabel={t('common.cancel')}
        busy={isSaving}
        busyLabel={t('common.loading')}
        onConfirm={handleSave}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
};

export default ClassDetail;
