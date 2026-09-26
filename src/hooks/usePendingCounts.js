import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { membershipReviewService } from '../services/membershipReviewService';
import { leaveRequestsService } from '../services/leaveRequestsService';
import { academicsService } from '../services/academicsService';
import { ROLES, requestInPov } from '../constants/roles';

/*
  How many things wait for this person's decision, for the numbers beside the
  sidebar items (owner, 2026-09-26) — so nobody has to open four pages to find
  where work is waiting.

  Each number is the one the page itself shows beside its own tab, never a
  second opinion: join requests are split by the desk exactly as
  JoinRequestsPage splits them (`requestInPov`), leave and teaching requests
  are the Principal's PENDING queues, and a homeroom teacher's number is the
  moves waiting for *their* decision (`canDecide`).

    PRINCIPAL — joinRequests · leaveRequests · teachingRequests
    TEACHER   — joinRequests · classMoves

  Read on arrival, again on navigation at most every 20 seconds (the backend
  rate-limits), and at once when a page reports a decision through
  `notifyPendingChanged()`. A read that fails leaves its number out.

  The 20 seconds are kept here, per member and role, not in the component.
  Each group of signed-in routes wears its own MainLayout, so moving between
  them mounts a new Sidebar — and a gap held in a ref started from zero every
  time, so every such move asked all three again. The last answer is kept
  beside it, so a freshly mounted Sidebar shows the numbers at once instead of
  nothing for twenty seconds.
*/

const EVENT = 'lms:pending-changed';
const MIN_GAP_MS = 20_000;

/** `${membershipId}:${role}` → { at, counts } — see above. */
const cache = new Map();

/** Call after deciding something the sidebar counts. */
export const notifyPendingChanged = () => window.dispatchEvent(new Event(EVENT));

const soft = (promise) => promise.catch(() => null);

async function countsFor(role) {
  if (role === ROLES.PRINCIPAL) {
    const [join, leave, teaching] = await Promise.all([
      soft(membershipReviewService.list('PENDING')),
      soft(leaveRequestsService.list('PENDING')),
      soft(academicsService.classSubjects('PENDING')),
    ]);
    return {
      joinRequests: join ? (join.requests ?? []).filter((row) => requestInPov(row, role)).length : null,
      leaveRequests: leave ? leave.length : null,
      teachingRequests: teaching ? teaching.length : null,
    };
  }
  if (role === ROLES.TEACHER) {
    const [join, moves] = await Promise.all([
      soft(membershipReviewService.list('PENDING')),
      soft(academicsService.classMoves()),
    ]);
    return {
      joinRequests: join ? (join.requests ?? []).filter((row) => requestInPov(row, role)).length : null,
      classMoves: moves ? moves.filter((move) => move.canDecide).length : null,
    };
  }
  return {};
}

export function usePendingCounts(role) {
  const { pathname } = useLocation();
  const { membership } = useAuth();
  const key = `${membership?.id ?? ''}:${role}`;
  /* The numbers live in the cache; this only asks for a render once a read lands. */
  const [, setVersion] = useState(0);
  const keyRef = useRef(key);

  const refresh = useCallback(
    (force) => {
      if (role !== ROLES.PRINCIPAL && role !== ROLES.TEACHER) return;
      const held = cache.get(key);
      if (!force && held && Date.now() - held.at < MIN_GAP_MS) return;
      const at = Date.now();
      cache.set(key, { at, counts: held?.counts ?? {} });
      countsFor(role).then((next) => {
        cache.set(key, { at, counts: next });
        if (keyRef.current === key) setVersion((n) => n + 1);
      });
    },
    [role, key]
  );

  /* A new member or role is a new set of numbers: none carried over. */
  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  useEffect(() => {
    refresh(false);
  }, [refresh, pathname]);

  useEffect(() => {
    const onChanged = () => refresh(true);
    window.addEventListener(EVENT, onChanged);
    return () => window.removeEventListener(EVENT, onChanged);
  }, [refresh]);

  return role === ROLES.PRINCIPAL || role === ROLES.TEACHER ? (cache.get(key)?.counts ?? {}) : {};
}
