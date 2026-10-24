import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { signedInHome } from '../../constants/roles';

/*
  Moving on from a Governing Body seat that ended - left, removed, or the body
  switched off (backend 3d7d05a). Two things this has to get past:

  - `/users/me` names the body the token names, ended seat or not, so the token is
    traded in first; that refresh drops a seat that no longer opens.
  - The refresh token's row is bound to the body, so the refresh opens nothing else -
    the new token names no place, even when one school is left (walked for real
    2026-10-24: kpril888 landed on /select-role holding a token with no school). So
    the one place left is opened (`openPlace`, a full load at its home), several go
    to /choose-school, none to where the session belongs.

  Answers false when the seat still opens (nothing to move on from), true when the
  page is being left.
*/
export function useMoveOn() {
  const { refreshMe, openPlace } = useAuth();
  const navigate = useNavigate();

  return useCallback(async () => {
    await authService.refresh().catch(() => {});
    const session = await refreshMe();
    if (session.governingBody?.id) return false;

    const places = Array.isArray(session.places) ? session.places : [];
    if (places.length === 1) {
      await openPlace(places[0]);
      return true;
    }
    navigate(places.length > 1 ? '/choose-school' : signedInHome(session), { replace: true });
    return true;
  }, [refreshMe, openPlace, navigate]);
}

export default useMoveOn;
