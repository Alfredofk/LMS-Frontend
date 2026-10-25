import { activeStore } from '../../services/apiClient';
import { GET_STARTED_PATH } from '../../constants/roles';

/*
  What was turned down, and which of it this person has already been told.

  Shared by RejectionNotice (which says it) and by /select-role and the signed-in
  shell (which decide whether it still needs saying). Sign-in lands straight on a
  dashboard since 2026-09-24, so the notice can no longer count on the role
  picker being passed through; whoever shows it asks here first.

  The memory lives in localStorage, per account (`lms_seen_rejections:<userId>`),
  as the last school does (owner 2026-10-25). It used to live in `activeStore()`
  beside the session, so without "Remember me" it died with the tab and every new
  sign-in announced the same old refusal again: a test school turned down weeks
  ago popped up each morning. Per account, another person on the same computer is
  never told it is seen; a new refusal is a new id and still speaks. What a
  session remembered under the old key is still read, so nothing seen before is
  announced again.
*/

const SEEN_KEY = 'lms_seen_rejections';

/* A short tail is enough: this only has to stop the dialog repeating, and an
   id that falls off the end belongs to a decision made long ago. */
const REMEMBER_LAST = 20;

/** The localStorage key for this account; null without one (then the old per-session key). */
export const seenKeyOf = (userId) => (userId ? `${SEEN_KEY}:${userId}` : null);

/* The signed-in account, as AuthContext keeps it (`lms_user`, beside the session). */
const currentUserId = () => {
  try {
    return JSON.parse(activeStore().getItem('lms_user') ?? 'null')?.id ?? null;
  } catch {
    return null;
  }
};

const listIn = (store, key) => {
  try {
    const raw = key ? store.getItem(key) : null;
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    /* Private mode, blocked storage, or something that is not JSON. Treating it
       as "nothing seen" shows the dialog again, which is the harmless way to be
       wrong. */
    return [];
  }
};

export const readSeen = () => {
  const own = listIn(localStorage, seenKeyOf(currentUserId()));
  const legacy = listIn(activeStore(), SEEN_KEY);
  return [...new Set([...own, ...legacy])];
};

export const rememberRejection = (id) => {
  try {
    const next = [...new Set([...readSeen(), id])].slice(-REMEMBER_LAST);
    const key = seenKeyOf(currentUserId());
    if (key) localStorage.setItem(key, JSON.stringify(next));
    else activeStore().setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    /* Storage refused. The dialog will simply say it again next time. */
    return;
  }
};

/*
  Everything that was turned down, newest concern first.

  The registration comes before the roles because founding a school is the larger
  decision, and somebody holding both a refused registration and a refused join
  request is looking at two different schools.
*/
export const rejectionsOf = (membership, registration) => {
  const found = [];

  if (registration?.status === 'REJECTED') {
    found.push({
      id: `registration:${registration.id}`,
      titleKey: 'rejected.registration.title',
      againKey: 'rejected.registration.again',
      next: GET_STARTED_PATH.PRINCIPAL,
      reason: registration.rejectionReason ?? null,
      role: null,
    });
  }

  /* Removing a member turns their waiting roles down with the removal's own
     reason. That is not a separate refusal to announce: /select-role already
     says they were removed, and why. */
  const ended = membership?.status === 'LEFT';

  for (const entry of ended ? [] : (membership?.roles ?? [])) {
    /* Sign-in sends bare strings and only the ACTIVE ones; a rejection can only
       arrive in the `/users/me` shape, which is an object. */
    if (typeof entry === 'string' || entry?.status !== 'REJECTED') continue;

    const next = GET_STARTED_PATH[entry.role];
    if (!next) continue;

    found.push({
      id: `role:${membership.id}:${entry.role}`,
      titleKey: 'rejected.role.title',
      againKey: 'rejected.role.again',
      next,
      reason: entry.rejectionReason ?? null,
      role: entry.role,
    });
  }

  return found;
};

/** Whether anything turned down has not been announced to this person yet. */
export const hasUnseenRejection = (membership, registration) => {
  const seen = readSeen();
  return rejectionsOf(membership, registration).some((item) => !seen.includes(item.id));
};
