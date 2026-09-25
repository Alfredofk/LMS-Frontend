import React, { useState } from 'react';

import Input from './ui/Input';
import Button from './ui/Button';
import ChildFields from './ChildFields';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { membershipService } from '../services/membershipService';
import { useT } from '../i18n/LanguageContext';
import { apiErrorMessage, guardianErrorMessage } from '../i18n/apiError';
import { ROLES, addsInstantly } from '../constants/roles';
import { teacherIdErrors, childErrors, childPayload, nestedFieldErrors } from '../utils/validation';

/*
  Adding TEACHER or GUARDIAN to the membership somebody already holds.

  `POST /api/memberships/me/roles`, backend `60ea459`. Two screens use it — My
  Profile, inline, and /get-started/teacher or /guardian for somebody who is
  already at a school — so it lives here beside SchoolCodeCard rather than inside
  either.

  ## No School Code

  Joining asks for a code first because the school is not known yet. Here it is:
  the route sits behind `requireActiveMembership`, and the school is the one in
  the token. So this is one step, not two.

  ## The token has to be traded in afterwards

  `requireRole` reads the roles **in the access token** (shared/auth.js:133), and
  those were fixed when it was minted. A role granted on the spot would still be
  refused by every screen behind it until the token is renewed — the same
  "approved, and then the app is broken" that /select-role already guards
  against for a school that is not in the token.

  So when the role comes back ACTIVE the token is traded once, and then
  `/users/me` is read again so every screen sees the new role. Only then: the
  backend rotates the refresh token on each trade and treats an old one coming
  back as theft, so trading when nothing changed is not free. A role that comes
  back PENDING changes nothing a token carries, and is not traded for.

  ## Which roles come back ACTIVE

  TEACHER, for a Principal — known before the press (`addsInstantly`). GUARDIAN,
  for the child's own homeroom teacher — known only to the server, which is the
  one that knows which class the child is in. So for GUARDIAN the sentence under
  the button says both, and the answer decides.

  One role per call from this app, and the body never carries a key for a role
  not asked for: the backend refuses that rather than ignoring it.
*/

const OWNED_FIELDS = {
  [ROLES.TEACHER]: ['nip', 'nuptk'],
  [ROLES.GUARDIAN]: ['childNisn', 'childFullName', 'relationship'],
};

const EMPTY = {
  [ROLES.TEACHER]: { nip: '', nuptk: '' },
  [ROLES.GUARDIAN]: { childNisn: '', childFullName: '', relationship: '' },
};

/*
  CONFLICT here means the role is already held or already waiting — not "an
  account with this email exists", which is what the app-wide default says.
  FORBIDDEN means the token does not name an active school.
*/
const ADD_ERRORS = {
  CONFLICT: 'addRole.error.conflict',
  FORBIDDEN: 'addRole.error.forbidden',
};

/**
 * @param {object} props
 * @param {'TEACHER'|'GUARDIAN'} [props.role] which role to add; TEACHER when omitted
 * @param {(result: { status: string, sessionUpdated: boolean }) => void} props.onDone
 *   called once the role is recorded; `status` is the role's own, ACTIVE or PENDING
 * @param {() => void} [props.onCancel] shows a Cancel button when given
 */
export const AddRoleForm = ({ role = ROLES.TEACHER, onDone, onCancel }) => {
  const { membership, refreshMe } = useAuth();
  const { t } = useT();

  const guardian = role === ROLES.GUARDIAN;
  const [values, setValues] = useState(EMPTY[role]);
  const [errors, setErrors] = useState({});
  const [isWorking, setIsWorking] = useState(false);

  const instant = addsInstantly(membership, role);
  const afterKey = guardian
    ? 'addRole.guardian.after'
    : instant
      ? 'addRole.after.instant'
      : 'addRole.after.review';

  const change = (name) => (e) => {
    const { value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name] || errors.global) setErrors((prev) => ({ ...prev, [name]: null, global: null }));
  };

  /* Each failing box gets its sentence; nothing is sent until none fails. */
  const check = () => {
    const fails = guardian ? childErrors(values) : teacherIdErrors(values.nip, values.nuptk);
    const next = {};
    for (const [name, fail] of Object.entries(fails)) {
      if (fail) next[name] = t(fail.key, fail.vars);
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const body = () => {
    if (guardian) return { roles: [ROLES.GUARDIAN], guardian: childPayload(values) };
    /* Blank boxes are left out, not sent empty: the payload is strict, and an
       empty string is not a NIP. */
    const teacher = {};
    if (values.nip.trim()) teacher.nip = values.nip.trim();
    if (values.nuptk.trim()) teacher.nuptk = values.nuptk.trim();
    return { roles: [ROLES.TEACHER], teacher };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isWorking || !check()) return;

    setIsWorking(true);
    let status;
    try {
      const answer = await membershipService.addRoles(body());
      status = answer?.roles?.find((entry) => entry.role === role)?.status ?? 'PENDING';
    } catch (err) {
      const fieldErrors = nestedFieldErrors(err.details, OWNED_FIELDS[role]);
      setErrors(
        Object.keys(fieldErrors).length
          ? fieldErrors
          : { global: guardian ? guardianErrorMessage(err, t) : apiErrorMessage(err, t, ADD_ERRORS) }
      );
      setIsWorking(false);
      return;
    }

    /*
      The role is recorded from here on, whatever happens next. A failed trade
      is reported, not treated as a failed request — asking again would only
      earn a 409.
    */
    let sessionUpdated = true;
    try {
      if (status === 'ACTIVE') await authService.refresh();
    } catch {
      sessionUpdated = false;
    }
    try {
      await refreshMe();
    } catch {
      /* The cached membership stays; the next /users/me corrects it. */
    }

    setIsWorking(false);
    onDone({ status, sessionUpdated });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left" noValidate>
      {guardian ? (
        <>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            {t('addRole.guardian.hint')}
          </p>
          <ChildFields values={values} errors={errors} onChange={change} idPrefix="addRole" />
        </>
      ) : (
        <>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            {t('getStarted.join.field.teacherIdsHint')}
          </p>

          <Input
            id="addRole-nip"
            name="nip"
            label={t('getStarted.join.field.nip')}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            value={values.nip}
            error={errors.nip || undefined}
            onChange={change('nip')}
          />

          <Input
            id="addRole-nuptk"
            name="nuptk"
            label={t('getStarted.join.field.nuptk')}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            value={values.nuptk}
            error={errors.nuptk || undefined}
            onChange={change('nuptk')}
          />
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

      {/* What happens next, said before the press rather than after it. */}
      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{t(afterKey)}</p>

      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} isDisabled={isWorking}>
            {t('common.cancel')}
          </Button>
        )}
        <Button type="submit" isLoading={isWorking}>
          {t(guardian ? 'addRole.guardian.submit' : 'addRole.submit')}
        </Button>
      </div>
    </form>
  );
};

export default AddRoleForm;
