import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';

import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import SelectField from '../../../components/ui/SelectField';
import { academicsService } from '../../../services/academicsService';
import { useT } from '../../../i18n/LanguageContext';
import { academicsErrorMessage } from '../../../i18n/apiError';
import { validateClassName, fieldErrorsFrom } from '../../../utils/validation';

/*
  A class, created with its homeroom teacher in the same action.

  The backend requires the teacher although the column is nullable (decision
  #53): a class without one would hold students' requests nobody can release.

  **Who can be picked is the backend's list**, `GET /academics/teachers` — ACTIVE
  members holding an ACTIVE TEACHER role. A Principal is on it only if they also
  teach. That makes an empty list the ordinary first state for a new school, not
  a failure, so it says where teachers come from instead of offering a select
  with nothing in it:

    - My Profile → Add the Teacher role, for a Principal who teaches (granted at
      once — the AddRoleCard there);
    - Join requests, where teachers who asked with the School Code are accepted.

  Grades are the school's own (`gradesFor`), so an SMA offers 10 to 12 and a
  four-year SMK adds 13; the server checks the same rule regardless.
*/
const OWNED_FIELDS = ['name', 'gradeLevel', 'homeroomTeacherMembershipId'];

export const ClassForm = ({ year, grades, onCreated, onCancel }) => {
  const navigate = useNavigate();
  const { t } = useT();

  const [teachers, setTeachers] = useState(null);
  const [teachersError, setTeachersError] = useState(null);
  const [values, setValues] = useState({ name: '', gradeLevel: '', homeroomTeacherMembershipId: '' });
  const [errors, setErrors] = useState({});
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    academicsService
      .teachers()
      .then((list) => !cancelled && setTeachers(list))
      .catch((err) => !cancelled && setTeachersError(academicsErrorMessage(err, t)));
    return () => {
      cancelled = true;
    };
  }, [t]);

  const change = (name) => (e) => {
    const { value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null, global: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isWorking) return;

    const next = {};
    const nameFail = validateClassName(values.name);
    if (nameFail) next.name = t(nameFail.key, nameFail.vars);
    if (!values.gradeLevel) next.gradeLevel = t('classes.class.error.gradeRequired');
    if (!values.homeroomTeacherMembershipId) next.homeroomTeacherMembershipId = t('classes.class.error.homeroomRequired');
    setErrors(next);
    if (Object.keys(next).length) return;

    setIsWorking(true);
    try {
      const created = await academicsService.createClass({
        academicYearId: year.id,
        name: values.name.trim(),
        gradeLevel: Number(values.gradeLevel),
        homeroomTeacherMembershipId: values.homeroomTeacherMembershipId,
      });
      onCreated(created);
    } catch (err) {
      const fields = fieldErrorsFrom(err.details, OWNED_FIELDS);
      setErrors(Object.keys(fields).length ? fields : { global: academicsErrorMessage(err, t) });
    } finally {
      setIsWorking(false);
    }
  };

  if (teachersError) {
    return (
      <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
        {teachersError}
      </div>
    );
  }

  if (teachers === null) {
    return <div className="h-40 bg-slate-50 rounded-2xl animate-pulse" aria-label={t('common.loading')} />;
  }

  if (teachers.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3" role="status">
        <div className="flex items-start gap-3">
          <UserPlus className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-extrabold text-slate-800">{t('classes.class.noTeachers.title')}</p>
            <p className="text-xs font-semibold text-slate-600 leading-relaxed">{t('classes.class.noTeachers.body')}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:pl-8">
          <Button size="sm" variant="outline" onClick={() => navigate('/profile')}>
            {t('classes.class.noTeachers.profile')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/join-requests')}>
            {t('classes.class.noTeachers.requests')}
          </Button>
          {onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left" noValidate>
      <Input
        id="className"
        name="name"
        label={t('classes.class.field.name')}
        placeholder={t('classes.class.field.namePlaceholder')}
        type="text"
        autoComplete="off"
        value={values.name}
        error={errors.name || undefined}
        onChange={change('name')}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SelectField
          id="gradeLevel"
          label={t('classes.class.field.grade')}
          value={values.gradeLevel}
          onChange={change('gradeLevel')}
          error={errors.gradeLevel}
        >
          <option value="">{t('classes.class.field.gradePlaceholder')}</option>
          {grades.map((grade) => (
            <option key={grade} value={grade}>
              {t('classes.grade', { n: grade })}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="homeroomTeacherMembershipId"
          label={t('classes.class.field.homeroom')}
          value={values.homeroomTeacherMembershipId}
          onChange={change('homeroomTeacherMembershipId')}
          error={errors.homeroomTeacherMembershipId}
        >
          <option value="">{t('classes.class.field.homeroomPlaceholder')}</option>
          {teachers.map((teacher) => (
            <option key={teacher.membershipId} value={teacher.membershipId}>
              {teacher.fullName}
            </option>
          ))}
        </SelectField>
      </div>

      {errors.global && (
        <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
          {errors.global}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} isDisabled={isWorking}>
            {t('common.cancel')}
          </Button>
        )}
        <Button type="submit" isLoading={isWorking}>
          {t('classes.class.create')}
        </Button>
      </div>
    </form>
  );
};

export default ClassForm;
