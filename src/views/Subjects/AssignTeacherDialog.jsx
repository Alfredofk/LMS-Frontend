import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import SelectField from '../../components/ui/SelectField';
import { academicsService } from '../../services/academicsService';
import { useT } from '../../i18n/LanguageContext';
import { subjectsErrorMessage } from '../../i18n/apiError';

/*
  The Principal names who teaches a subject in one class, one semester —
  `POST /academics/class-subjects/override`. ACTIVE at once, whether or not the
  teachers' registration deadline has passed; the slot, year and semester rules
  still hold (resolveSlot), and so does one teacher per slot.

  The subjects offered are the ones still free in this class (`freeSubjects`),
  national first; the teachers are `GET /academics/teachers` — ACTIVE members
  holding an ACTIVE TEACHER role. Every refusal stays inside the dialog.
*/
export const AssignTeacherDialog = ({ boardClass, semester, subjects, teachers, onClose, onAssigned }) => {
  const { t } = useT();
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const openerRef = useRef(null);
  const firstRef = useRef(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    firstRef.current?.querySelector('select')?.focus();
    return () => {
      if (openerRef.current?.isConnected) openerRef.current.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (busy || e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  const national = subjects.filter((subject) => subject.national);
  const local = subjects.filter((subject) => !subject.national);
  const subject = subjects.find((entry) => entry.id === subjectId) ?? null;
  const teacher = (teachers ?? []).find((entry) => entry.membershipId === teacherId) ?? null;
  const noTeachers = teachers !== null && teachers.length === 0;

  const handleAssign = async () => {
    const next = {};
    if (!subject) next.subject = t('subjects.assign.subjectRequired');
    if (!teacher) next.teacher = t('subjects.assign.teacherRequired');
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const assigned = await academicsService.assignClassSubject({
        classId: boardClass.id,
        subjectId: subject.id,
        semesterId: semester.id,
        teacherMembershipId: teacher.membershipId,
      });
      onAssigned(assigned);
    } catch (err) {
      setBusy(false);
      setErrors({ global: subjectsErrorMessage(err, t) });
    }
  };

  const option = (entry) => (
    <option key={entry.id} value={entry.id}>
      {entry.code} — {entry.name}
    </option>
  );

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={busy ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-teacher-title"
        aria-describedby="assign-teacher-body"
        aria-busy={busy}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 sm:p-7 space-y-4 text-left max-h-[90dvh] overflow-y-auto"
      >
        <div className="space-y-2">
          <h2 id="assign-teacher-title" className="text-base font-extrabold text-slate-900 tracking-tight break-words">
            {t('subjects.assign.title', { className: boardClass.name })}
          </h2>
          <p id="assign-teacher-body" className="text-xs text-slate-500 font-medium leading-relaxed">
            {t('subjects.assign.body', { n: semester.ordinal, year: semester.academicYear })}
          </p>
        </div>

        {subjects.length === 0 ? (
          <p className="text-xs font-semibold text-slate-600 leading-relaxed">{t('subjects.assign.noneFree')}</p>
        ) : (
          <div ref={firstRef}>
            <SelectField
              id="assign-subject"
              label={t('subjects.assign.subject')}
              value={subjectId}
              disabled={busy}
              error={errors.subject}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setErrors((prev) => ({ ...prev, subject: null, global: null }));
              }}
            >
              <option value="">{t('subjects.assign.subjectPlaceholder')}</option>
              {national.length > 0 && <optgroup label={t('subjects.kind.national')}>{national.map(option)}</optgroup>}
              {local.length > 0 && <optgroup label={t('subjects.kind.local')}>{local.map(option)}</optgroup>}
            </SelectField>
          </div>
        )}

        {teachers === null ? (
          <div className="h-12 bg-slate-50 rounded-xl animate-pulse" aria-label={t('common.loading')} />
        ) : noTeachers ? (
          <p className="text-xs font-semibold text-slate-600 leading-relaxed">{t('subjects.assign.noTeachers')}</p>
        ) : (
          subjects.length > 0 && (
            <SelectField
              id="assign-teacher"
              label={t('subjects.assign.teacher')}
              value={teacherId}
              disabled={busy}
              error={errors.teacher}
              onChange={(e) => {
                setTeacherId(e.target.value);
                setErrors((prev) => ({ ...prev, teacher: null, global: null }));
              }}
            >
              <option value="">{t('subjects.assign.teacherPlaceholder')}</option>
              {teachers.map((entry) => (
                <option key={entry.membershipId} value={entry.membershipId}>
                  {entry.fullName}
                  {entry.membershipId === boardClass.homeroomTeacher?.membershipId ? ` (${t('subjects.assign.homeroomMark')})` : ''}
                </option>
              ))}
            </SelectField>
          )
        )}

        {subject && teacher && (
          <p className="text-xs font-semibold text-slate-600 leading-relaxed">
            {t('subjects.assign.summary', { teacher: teacher.fullName, subject: subject.name, className: boardClass.name })}
          </p>
        )}

        {errors.global && (
          <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
            {errors.global}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold text-slate-600 border border-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
              busy ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 cursor-pointer'
            }`}
          >
            {t('common.cancel')}
          </button>
          {subjects.length > 0 && !noTeachers && (
            <button
              type="button"
              onClick={handleAssign}
              disabled={busy}
              className={`px-5 py-2 rounded-xl text-xs font-extrabold text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 bg-brand hover:bg-brand-deep focus-visible:ring-brand ${
                busy ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {busy ? t('common.loading') : t('subjects.assign.confirm')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AssignTeacherDialog;
