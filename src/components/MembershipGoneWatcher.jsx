import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { onMembershipGone } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';

/*
  When the backend says this session's school is no longer theirs, go to the
  page that explains it.

  `apiClient` announces the 403 "not an active member" (isMembershipGone): the
  person was removed, left on another device, or their school was switched off,
  and `requireActiveMembership` reads the database, so the refusal is immediate
  while the cached session still names the school. Without this every screen
  showed its own error until the token ran out.

  So: read `/users/me` again — which reports LEFT with the reason, or the
  school's deactivation — and go to /select-role, whose panels say what
  happened. Once per burst: a dashboard fires several requests at once, and all
  of them are refused together.

  Renders nothing; it lives in MainLayout, the shell every signed-in screen wears.
*/
export const MembershipGoneWatcher = () => {
  const navigate = useNavigate();
  const { refreshMe } = useAuth();
  const handling = useRef(false);

  useEffect(
    () =>
      onMembershipGone(async () => {
        if (handling.current) return;
        handling.current = true;
        try {
          await refreshMe();
        } catch {
          /* /select-role reads it again on arrival. */
        }
        navigate('/select-role', { replace: true });
        handling.current = false;
      }),
    [navigate, refreshMe]
  );

  return null;
};

export default MembershipGoneWatcher;
