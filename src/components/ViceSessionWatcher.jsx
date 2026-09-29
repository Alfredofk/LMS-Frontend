import { useEffect, useRef } from 'react';

import { accessTokenClaims, onForbidden } from '../services/apiClient';
import { authService } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { ROLES } from '../constants/roles';

/*
  Keeps a Vice Principal's session honest about the role (backend `89a5666`).

  `requireRole` reads roles from the **access token**, while the services re-read
  the database. So two states refuse with 403 while the screen still believes:

    - **Revoked.** The token still says VICE_PRINCIPAL, the service answers
      "Only the Principal or a Vice Principal". Re-reading `/users/me` finds the
      role ENDED; AuthContext enters the default role instead and records the
      drop (`droppedRole`), ProtectedRoute sends the person to that role's home,
      and this says why.
    - **Just appointed.** `/users/me` says ACTIVE, the token predates it and
      `requireRole` refuses. The token is traded in and the page reloaded, once,
      so every read on it runs with the new claim. AccountMenu trades before
      entering the role, so this is only the backstop.

  The navigation is not done here. Walked 2026-09-29: any screen may be the one
  whose refreshMe() finds the role gone — ClassesPage calls it on mount — and
  the new role then rendered on the Vice Principal's page, whose ProtectedRoute
  answered /unauthorized. Deciding it in ProtectedRoute covers every caller.

  The notice is read from `droppedRole` whenever it changes, so it is said by
  whichever layout is mounted once the role has moved.

  Renders nothing; it lives in MainLayout beside MembershipGoneWatcher.
*/
export const ViceSessionWatcher = ({ showToast }) => {
  const { activeRole, refreshMe, droppedRole, clearDroppedRole } = useAuth();
  const { t } = useT();
  const handling = useRef(false);

  /* Keyed on the drop, not on showToast: MainLayout makes a new one every render. */
  useEffect(() => {
    if (!droppedRole) return;
    if (droppedRole.from === ROLES.VICE_PRINCIPAL) {
      showToast?.(t('vice.revoked', { role: t(`roleTitle.${droppedRole.to}`) }), 'info');
    }
    clearDroppedRole();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on the drop only; see above
  }, [droppedRole]);

  useEffect(() => {
    if (activeRole !== ROLES.VICE_PRINCIPAL) return undefined;
    /* Once per burst: a page fires several requests and all are refused together. */
    return onForbidden(async () => {
      if (handling.current) return;
      handling.current = true;
      try {
        const session = await refreshMe();
        if (!session.roles.includes(ROLES.VICE_PRINCIPAL)) return; // revoked — see above
        const claimed = accessTokenClaims()?.roles ?? [];
        if (!claimed.includes(ROLES.VICE_PRINCIPAL)) {
          await authService.refresh();
          window.location.reload();
        }
        /* Otherwise the refusal is the screen's own, e.g. deciding one's own
           teaching request; it says so itself. */
      } catch {
        /* The screen already shows its error. */
      } finally {
        handling.current = false;
      }
    });
  }, [activeRole, refreshMe]);

  return null;
};

export default ViceSessionWatcher;
