import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Check } from 'lucide-react';

import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { membershipService } from '../../services/membershipService';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import { gradesFor } from '../../constants/schoolTypes';
import {
  normaliseSchoolCode,
  validateSchoolCode,
  validateNisn,
  validateBirthDate,
  validateGradeLevel,
  validateNip,
  validateNuptk,
  validateTeacherIds,
  validateChildFullName,
  validateRelationship,
} from '../../utils/validation';

/*
  Asking to join a school that already exists.

  ## Two steps, because the backend offers two calls

  `POST /memberships/lookup` answers with a school's name, type and city — three
  fields and nothing else, so a leaked School Code buys a name and not a roster.
  `POST /memberships/requests` is the request itself.

  Splitting them is not ceremony. Somebody is about to hand over their NISN or
  their NIP, and the code they typed came off a WhatsApp message read out over a
  phone. Showing them the school first is what lets them say "no, wrong one"
  before the identifiers leave the browser, and it turns a mistyped code into a
  question rather than a rejected form.

  ## A student names a grade, never a class

  The homeroom teacher chooses the class when they release the request. That is
  what keeps a leaked code from exposing a class list, and it lets a school take
  requests before it has created a single class. The grade options come from the
  school type the lookup just told us, so an SD offers 1 to 6 and nothing else.

  ## One request may carry two roles, and this is the only chance to say so

  `assertRoleCombinationAllowed` (`shared/approval.js:28`) allows TEACHER with
  GUARDIAN — a teacher whose own child attends the same school — and refuses
  STUDENT alongside anything at all.

  What makes the checkbox below a necessity rather than a convenience is a
  different rule: **there is no way to add a role later.**
  `assertEligibleApplicant` (`membership.service.js:194`) turns away anybody who
  already holds a PENDING or ACTIVE membership, backed by the partial unique index
  `SchoolMembership_one_pending_or_active_per_user`. Leaving a school is ticket 06
  and is not written. So a teacher who does not tick the box here is a teacher and
  nothing else, permanently — and the label has to say so.

  ## PRINCIPAL is not here

  The first Principal is created by the platform admin who approves the school
  registration. A second is a later feature, not something a stranger asks for,
  and `REQUESTABLE_ROLES` leaves it out. A Principal cannot add GUARDIAN either,
  for the same reason as everybody else: they already hold a membership.
*/

/** What each intent asks for. The teacher path can grow a second role; see below. */
const ROLES_BY_INTENT = {
  student: ['STUDENT'],
  teacher: ['TEACHER'],
  guardian: ['GUARDIAN'],
};

/** Which boxes on this screen belong to which role — used to route server errors. */
const FIELDS_BY_ROLE = {
  STUDENT: ['nisn', 'birthDate', 'gradeLevel'],
  TEACHER: ['nip', 'nuptk'],
  GUARDIAN: ['childNisn', 'childFullName', 'relationship'],
};

/*
  `fieldErrorsFrom` in utils/validation.js reads the FIRST segment of a zod path,
  which is right for the flat forms it was written for. This body is nested — an
  issue on the NISN arrives as `student.nisn`, the "give a NIP or a NUPTK"
  refinement as `teacher.nip`, and a guardian's as `guardian.childNisn` — so here
  the LAST segment is the one that names a box on this screen.

  The last segments stay unique across roles, which is why this works with two
  roles in flight: a student's own number is `nisn`, a guardian's child's is
  `childNisn`.
*/
const nestedFieldErrors = (details, owned) => {
  if (!Array.isArray(details)) return {};

  return details.reduce((acc, issue) => {
    const parts = String(issue?.path ?? '').split('.');
    const field = parts[parts.length - 1];
    if (field && owned.includes(field) && !acc[field]) acc[field] = issue.message;
    return acc;
  }, {});
};

export const JoinSchoolForm = ({ intent }) => {
  const navigate = useNavigate();
  const { t } = useT();

  const [code, setCode] = useState('');
  const [school, setSchool] = useState(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [isWorking, setIsWorking] = useState(false);
  const [alsoGuardian, setAlsoGuardian] = useState(false);

  /*
    Only the teacher path can grow a second role. STUDENT is exclusive by the
    backend's rule, and the guardian path is already the role it names.
  */
  const canAddGuardian = intent === 'teacher';
  const roles =
    canAddGuardian && alsoGuardian
      ? [...ROLES_BY_INTENT.teacher, 'GUARDIAN']
      : (ROLES_BY_INTENT[intent] ?? []);

  const asks = (role) => roles.includes(role);
  const ownedFields = roles.flatMap((role) => FIELDS_BY_ROLE[role] ?? []);

  const setFieldError = (name, fail) =>
    setErrors((prev) => ({ ...prev, [name]: fail ? t(fail.key, fail.vars) : null }));

  /* One handler for every box: they all live in the same flat `values` bag. */
  const change = (name) => (e) => {
    const { value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setFieldError(name, null);
  };

  /* ---------------- step one: the code ---------------- */

  const handleLookup = async (e) => {
    e.preventDefault();
    if (isWorking) return;

    const fail = validateSchoolCode(code);
    if (fail) {
      setErrors({ schoolCode: t(fail.key, fail.vars) });
      return;
    }

    setErrors({});
    setIsWorking(true);
    try {
      const found = await membershipService.lookupSchool(normaliseSchoolCode(code));
      /*
        A 200 that carries no school should not move anybody to step two. Without
        this the screen simply re-renders step one with nothing said, which is how
        the first version of this failed — silently, and only on a real server.
      */
      if (!found?.name) {
        setErrors({ schoolCode: t('error.unknown') });
        return;
      }
      setSchool(found);
    } catch (err) {
      setErrors({ schoolCode: apiErrorMessage(err, t) });
    } finally {
      setIsWorking(false);
    }
  };

  /* ---------------- step two: who is asking ---------------- */

  /*
    Every requested role is checked, and all of their complaints land in **one**
    object. The earlier version gave each role its own `next` and called
    `setErrors` from inside its branch — harmless while exactly one role could be
    asked for, and wrong the moment two can: whichever branch ran last would wipe
    the other's messages, and somebody would fix a NIP only to discover the child
    fields were also empty.
  */
  const checkAll = () => {
    const next = {};
    const put = (name, fail) => {
      if (fail) next[name] = t(fail.key, fail.vars);
    };

    if (asks('STUDENT')) {
      put('nisn', validateNisn(values.nisn ?? ''));
      put('birthDate', validateBirthDate(values.birthDate ?? ''));
      put('gradeLevel', validateGradeLevel(values.gradeLevel ?? '', school?.schoolType));
    }

    if (asks('TEACHER')) {
      const nipFail = validateNip(values.nip ?? '');
      const nuptkFail = validateNuptk(values.nuptk ?? '');
      put('nip', nipFail);
      put('nuptk', nuptkFail);

      /* Only when neither is filled: a shape complaint above is the better
         message when one of them was attempted. */
      if (!nipFail && !nuptkFail) {
        put('nip', validateTeacherIds(values.nip ?? '', values.nuptk ?? ''));
      }
    }

    if (asks('GUARDIAN')) {
      put('childNisn', validateNisn(values.childNisn ?? ''));
      put('childFullName', validateChildFullName(values.childFullName ?? ''));
      put('relationship', validateRelationship(values.relationship ?? ''));
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /*
    One payload per requested role, and **only** for the roles requested: the
    backend refuses a payload for a role that was not asked for rather than
    ignoring it, the same strictness the school registration applies to a duration
    an SMA may not choose. That is why these are three `if`s rather than one
    object built up front — an unticked guardian box must leave no trace.
  */
  const buildBody = () => {
    const body = { schoolCode: normaliseSchoolCode(code), roles };

    if (asks('STUDENT')) {
      body.student = {
        nisn: values.nisn.trim(),
        birthDate: values.birthDate,
        gradeLevel: Number(values.gradeLevel),
      };
    }

    if (asks('TEACHER')) {
      /* Blank fields are omitted, not sent empty: the payload is strict, and an
         empty string is not a NIP. */
      const teacher = {};
      if (values.nip?.trim()) teacher.nip = values.nip.trim();
      if (values.nuptk?.trim()) teacher.nuptk = values.nuptk.trim();
      body.teacher = teacher;
    }

    if (asks('GUARDIAN')) {
      body.guardian = {
        childNisn: values.childNisn.trim(),
        childFullName: values.childFullName.trim(),
        relationship: values.relationship.trim(),
      };
    }

    return body;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isWorking) return;
    if (!checkAll()) return;

    setIsWorking(true);
    try {
      await membershipService.requestJoin(buildBody());
      /*
        No success toast: navigating away unmounts this form and the toast with
        it. /select-role reads the membership back from /users/me and shows the
        card as pending — a state that stays put beats a flash that does not.
      */
      navigate('/select-role', { replace: true });
    } catch (err) {
      const fieldErrors = nestedFieldErrors(err.details, ownedFields);
      if (Object.keys(fieldErrors).length) {
        setErrors((prev) => ({ ...prev, ...fieldErrors }));
      } else {
        setErrors((prev) => ({ ...prev, global: apiErrorMessage(err, t) }));
      }
    } finally {
      setIsWorking(false);
    }
  };

  /* ---------------- rendering ---------------- */

  if (!school) {
    return (
      <form onSubmit={handleLookup} className="space-y-5 text-left" noValidate>
        <Input
          id="schoolCode"
          name="schoolCode"
          label={t('getStarted.join.field.code')}
          type="text"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="characters"
          placeholder={t('getStarted.join.field.codePlaceholder')}
          value={code}
          error={errors.schoolCode || undefined}
          onChange={(e) => {
            setCode(e.target.value);
            if (errors.schoolCode) setErrors({});
          }}
        />
        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          {t('getStarted.join.field.codeHint')}
        </p>

        <Button type="submit" size="lg" className="w-full" isLoading={isWorking}>
          {t('getStarted.join.action.lookup')}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 text-left" noValidate>
      {/* What the code turned out to be. This is the whole reason for step one:
          a chance to say "wrong school" before the identifiers are typed. */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-brand-tint/60 border border-brand/20">
        <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm">
          <Building2 className="w-4 h-4 text-brand" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-slate-900 leading-tight">{school.name}</p>
          {/* `School.city` is nullable, so the separator is conditional: without
              this a school that never filled its town in reads "SMA · ". */}
          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
            {school.schoolType}
            {school.city ? ` · ${school.city}` : ''}
          </p>
          <button
            type="button"
            onClick={() => {
              setSchool(null);
              setValues({});
              setErrors({});
            }}
            className="mt-1.5 text-[11px] font-extrabold text-brand hover:text-brand-deep underline underline-offset-2 cursor-pointer focus:outline-none"
          >
            {t('getStarted.join.action.changeCode')}
          </button>
        </div>
        <Check className="w-4 h-4 text-brand shrink-0 mt-2.5" aria-hidden="true" />
      </div>

      {asks('STUDENT') && (
        <>
          <Input
            id="nisn"
            name="nisn"
            label={t('getStarted.join.field.nisn')}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            value={values.nisn ?? ''}
            error={errors.nisn || undefined}
            onChange={change('nisn')}
          />

          <Input
            id="birthDate"
            name="birthDate"
            label={t('getStarted.join.field.birthDate')}
            type="date"
            value={values.birthDate ?? ''}
            error={errors.birthDate || undefined}
            onChange={change('birthDate')}
          />

          {/* Only the grades this school actually has — an SD offers 1 to 6, an
              SMA 10 to 12. The server checks the same thing; offering the rest
              would be inviting a 400. */}
          <div className="w-full flex flex-col gap-1.5">
            <label
              htmlFor="gradeLevel"
              className="text-sm font-semibold text-slate-700 select-none"
            >
              {t('getStarted.join.field.gradeLevel')}
            </label>
            <select
              id="gradeLevel"
              name="gradeLevel"
              value={values.gradeLevel ?? ''}
              onChange={change('gradeLevel')}
              className="block w-full rounded-xl border border-slate-200 hover:border-slate-300 bg-white py-2.5 md:py-3 px-4 text-base text-slate-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand cursor-pointer"
            >
              <option value="">{t('getStarted.join.field.gradePlaceholder')}</option>
              {gradesFor(school.schoolType).map((grade) => (
                <option key={grade} value={grade}>
                  {t('getStarted.join.field.gradeOption', { n: grade })}
                </option>
              ))}
            </select>
            {errors.gradeLevel && (
              <p className="text-xs text-red-500 font-medium">{errors.gradeLevel}</p>
            )}
          </div>
        </>
      )}

      {asks('TEACHER') && (
        <>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            {t('getStarted.join.field.teacherIdsHint')}
          </p>

          <Input
            id="nip"
            name="nip"
            label={t('getStarted.join.field.nip')}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            value={values.nip ?? ''}
            error={errors.nip || undefined}
            onChange={change('nip')}
          />

          <Input
            id="nuptk"
            name="nuptk"
            label={t('getStarted.join.field.nuptk')}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            value={values.nuptk ?? ''}
            error={errors.nuptk || undefined}
            onChange={change('nuptk')}
          />
        </>
      )}

      {/*
        The second role, offered once and never again.

        The hint under it is not decoration: roles cannot be added to a membership
        that already exists, so somebody who leaves this unticked has decided,
        not postponed.
      */}
      {canAddGuardian && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <label htmlFor="alsoGuardian" className="flex items-start gap-3 cursor-pointer">
            <input
              id="alsoGuardian"
              name="alsoGuardian"
              type="checkbox"
              checked={alsoGuardian}
              onChange={(e) => setAlsoGuardian(e.target.checked)}
              className="mt-0.5 w-4 h-4 shrink-0 rounded border-slate-300 text-brand focus:ring-brand cursor-pointer"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-700">
                {t('getStarted.join.alsoGuardian')}
              </span>
              <span className="block text-[11px] text-slate-500 font-medium leading-relaxed mt-0.5">
                {t('getStarted.join.alsoGuardian.hint')}
              </span>
            </span>
          </label>
        </div>
      )}

      {asks('GUARDIAN') && (
        <>
          {/* The child is named, never listed. Both the number and the name have
              to be known already — that pairing is the out-of-band check, and
              nothing here will look a child up. */}
          <Input
            id="childNisn"
            name="childNisn"
            label={t('getStarted.join.field.childNisn')}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            value={values.childNisn ?? ''}
            error={errors.childNisn || undefined}
            onChange={change('childNisn')}
          />

          <Input
            id="childFullName"
            name="childFullName"
            label={t('getStarted.join.field.childFullName')}
            type="text"
            autoComplete="off"
            value={values.childFullName ?? ''}
            error={errors.childFullName || undefined}
            onChange={change('childFullName')}
          />

          <Input
            id="relationship"
            name="relationship"
            label={t('getStarted.join.field.relationship')}
            type="text"
            autoComplete="off"
            placeholder={t('getStarted.join.field.relationshipPlaceholder')}
            value={values.relationship ?? ''}
            error={errors.relationship || undefined}
            onChange={change('relationship')}
          />

          {/*
            Said plainly rather than discovered later. A guardian request is
            released by the homeroom teacher of the child's class
            (`membership.service.js:422`), and classes cannot be created yet
            (ticket 07) — so nobody can act on this one today. Somebody waiting
            deserves to know they are waiting on a thing that does not exist.
          */}
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 font-semibold leading-relaxed">
            {t('getStarted.join.guardian.waiting')}
          </p>
        </>
      )}

      {errors.global && (
        <div
          className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold"
          role="alert"
        >
          {errors.global}
        </div>
      )}

      <Button type="submit" size="lg" className="w-full" isLoading={isWorking}>
        {t('getStarted.join.action.submit')}
      </Button>

      <p className="text-[11px] text-slate-500 font-medium leading-relaxed text-center">
        {t('getStarted.join.approval')}
      </p>
    </form>
  );
};

export default JoinSchoolForm;
