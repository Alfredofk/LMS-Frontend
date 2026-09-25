import React, { useEffect, useState } from 'react';

import RejectionNotice from '../views/Role/RejectionNotice';
import { usersService } from '../services/usersService';
import { schoolService } from '../services/schoolService';
import { useAuth } from '../context/AuthContext';

/*
  A rejection, said over the dashboard.

  Sign-in goes straight to a dashboard since 2026-09-24 — the owner did not want
  the role picker at every sign-in — so the picker is no longer the place every
  refusal is sure to be seen. This asks once per person per page load: sign-in
  answers only ACTIVE roles, so the turned-down ones come from `/users/me`, and a
  refused school registration from `/school-registrations/mine`. Then the same
  RejectionNotice the picker shows decides, from what has been dismissed before,
  whether there is anything left to say. Almost always there is not, and nothing
  renders.

  The answer is read here and not written into the session: pages that need the
  fuller membership read it themselves, and a background check must not move
  somebody's active role under them.

  Asked once per person per page load, not per mount — the signed-in routes
  each wear their own MainLayout, so moving between them mounts this again.
*/
const asked = new Set();

export const SessionRejectionNotice = () => {
  const { user } = useAuth();
  const [found, setFound] = useState(null);

  useEffect(() => {
    if (!user?.id || asked.has(user.id)) return;
    asked.add(user.id);
    Promise.all([
      usersService.getMe(),
      schoolService.listMyRegistrations().catch(() => null),
    ])
      .then(([me, mine]) =>
        setFound({ membership: me?.membership ?? null, registration: mine?.registrations?.[0] ?? null })
      )
      /* A notice that cannot be checked is simply not shown; nothing here is
         worth an error on top of the page somebody came for. */
      .catch(() => {});
  }, [user?.id]);

  if (!found) return null;
  return <RejectionNotice membership={found.membership} registration={found.registration} />;
};

export default SessionRejectionNotice;
