import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, UserMinus, Users } from 'lucide-react';

import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import SelectField from '../../../components/ui/SelectField';
import RemoveMemberDialog from '../../../components/RemoveMemberDialog';
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

  **A student can be taken out from the roster** — `POST /api/members/:id/remove`,
  which both readers of this component may do: the Principal for anyone, the
  homeroom teacher for a student in their own class (the backend checks the
  placement, not this screen). `membershipId` on each roster row is exactly what
  that route takes. The row leaves the roster at once, and `onChanged` hears the
  smaller count so the list behind this page does not keep the old number.

  `readOnly` is for the homeroom teacher's own page (/teacher/homeroom): they see
  the same class and roster, and the change-homeroom control is not rendered —
  the list of teachers behind it answers a teacher 403.
*/
export const ClassDetail = ({ classId, onBack, onChanged, showToast, readOnly = false }) => {
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
  const candidates = (teachers ?? []).filter(
    (teacher) => teacher.membershipId !== target.homeroomTeacher?.membershipId
  );

  return (
    <div className="space-y-4">
      {back}

      <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{target.name}</h2>
          <span className="px-2 py-0.5 bg-brand-tint text-brand text-[10px] font-extrabold rounded-md">
            {t('classes.grade', { n: target.gradeLevel })}
          </span>
          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-extrabold rounded-md">
            {target.academicYear?.label}
          </span>
        </div>

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

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
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
        <div className="flex items-center gap-2 text-slate-500">
          <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
          <h3 className="text-[11px] font-bold uppercase tracking-wider">
            {t('classes.detail.students', { n: students.length })}
          </h3>
        </div>

        {students.length === 0 ? (
          <p className="mt-3 text-xs font-semibold text-slate-500 leading-relaxed">
            {t('classes.detail.noStudents')}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {students.map((student) => (
              <li key={student.studentProfileId} className="py-2.5 flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-800 break-words">{student.fullName}</span>
                  <span className="block text-[11px] font-semibold text-slate-500 tabular-nums">
                    {t('profile.nisn')} {student.nisn ?? '—'} · {t('classes.detail.since', { date: formatDay(student.placedAt, lang) })}
                  </span>
                </span>
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
              </li>
            ))}
          </ul>
        )}
      </section>

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
