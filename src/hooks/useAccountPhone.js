import { useEffect, useRef } from 'react';

import { useAuth } from '../context/AuthContext';

/*
  A person's own phone number (backend a9ed505, ticket 23).

  `User.phone` belongs to the account, not to a school: the same number wherever
  they are. A guardian must have one — joining as GUARDIAN, or adding it, without
  one on the account is a 400 on `guardian.phone` — and anybody may set or clear
  theirs from their profile (`PATCH /users/me`). Only the Principal and the Vice
  Principals read it (`GET /members/:id`), which is what the hint says.

  ## Why the number may not be known yet

  `/users/me` carries `user.phone`; the sign-in answers do not (users.service.js
  `meOf` adds it there only, to keep their shape). So right after signing in the
  cached user has no `phone` key at all — undefined, as opposed to null for "has
  none". `useAccountPhone` reads /users/me once when that is the case, so a form
  can fill the box with the number already on the account.
*/

/**
 * The account's phone number: a string, null when it has none, or undefined
 * while it is not known yet (then /users/me is read once).
 */
export function useAccountPhone() {
  const { user, refreshMe } = useAuth();
  const asked = useRef(false);
  const phone = user?.phone;

  useEffect(() => {
    if (!user || phone !== undefined || asked.current) return;
    asked.current = true;
    refreshMe().catch(() => {
      /* The box simply starts empty; the server still checks. */
    });
  }, [user, phone, refreshMe]);

  return phone;
}

/**
 * Fills `values.phone` with the account's number once it is known, unless
 * something was typed first. `setValues` is the form's own state setter.
 */
export function usePhonePrefill(setValues) {
  const accountPhone = useAccountPhone();

  useEffect(() => {
    if (!accountPhone) return;
    setValues((prev) => (prev.phone ? prev : { ...prev, phone: accountPhone }));
  }, [accountPhone, setValues]);
}
