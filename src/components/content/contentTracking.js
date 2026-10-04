import { useEffect, useState } from 'react';

import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';
import { trackingService } from '../../services/trackingService';
import { createTracker } from './tracker';

/*
  A tracker for one reading of a meeting's content - a drawer opened, a meeting's
  page visited - for a reader working as a student only (the route is
  STUDENT-only; staff reading content is not tracked). Null for anybody else, and
  when `enabled` is false.

  What it gathers is sent every few seconds, when the tab is hidden or closed, and
  when the reading ends (tracker.js has the rules and the batching).
*/

const FLUSH_MS = 8_000;

export function useContentTracker(enabled = true) {
  const { activeRole } = useAuth();
  const [tracker] = useState(() =>
    enabled && activeRole === ROLES.STUDENT
      ? createTracker({ send: (events, options) => trackingService.send(events, options) })
      : null
  );

  useEffect(() => {
    if (!tracker) return undefined;
    const timer = setInterval(() => tracker.flush().catch(() => {}), FLUSH_MS);
    const away = () => tracker.flush({ keepalive: true }).catch(() => {});
    const onVisibility = () => document.visibilityState === 'hidden' && away();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', away);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', away);
      /* After the items' own clean-ups, so a video's last position is in. */
      setTimeout(away, 0);
    };
  }, [tracker]);

  return tracker;
}
