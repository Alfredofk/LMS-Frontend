import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UserPlus } from 'lucide-react';

import { modalActions, modalCancelClass, modalConfirmClass } from '../../components/ui/modalStyles';
import ModalHeading from '../../components/ui/ModalHeading';

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
    firstRef.current?.querySelector('[role="combobox"]')?.focus();
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
      {entry.code} - {entry.name}
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
        <ModalHeading
          tone="brand"
          icon={UserPlus}
          titleId="assign-teacher-title"
          title={t('subjects.assign.title', { className: boardClass.name })}
          bodyId="assign-teacher-body"
          body={t('subjects.assign.body', { n: semester.ordinal, year: semester.academicYear })}
        />

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

        <div className={modalActions}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={modalCancelClass(busy)}
          >
            {t('common.cancel')}
          </button>
          {subjects.length > 0 && !noTeachers && (
            <button
              type="button"
              onClick={handleAssign}
              disabled={busy}
              className={modalConfirmClass('brand', busy)}
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
