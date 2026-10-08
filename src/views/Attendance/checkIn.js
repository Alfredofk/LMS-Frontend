/*
  Today's meetings and the student's check-in (owner, 2026-10-03) — what the card
  decides, apart from its markup so it can be tested.

  The meetings come from `GET /sessions/mine` (backend 87f2670/2a281e7, see
  sessionsService.mine): today in the school's zone, each carrying the student's
  own `attendance` and `canCheckIn`. The check-in is
  `POST /attendance/sessions/:id/check-in` with where the student stands.

  `canCheckIn` is the server's answer at the moment it read: the window, the
  current Class, no record yet, and the school having a point
  (sessions.service.js listMine). It goes stale as the clock runs — a meeting at
  10:00 read at 07:00 says false — so the card reads again when the next check-in
  opens, starts or ends (`nextReadIn`), and this file only says what the row
  shows in between.
*/

/*
  Check-in opens 30 minutes before a meeting starts (backend 0fb6cb9, owner
  2026-10-08; at the start until then) and closes at its end, or when the teacher
  confirms. Late still counts from the start. The server's `checkInOpeningOf`.
*/
export const CHECK_IN_EARLY_MS = 30 * 60 * 1000;

/** When a meeting's check-in opens, as a Date. */
export const checkInOpensAt = (session) => new Date(new Date(session.startsAt).getTime() - CHECK_IN_EARLY_MS);

/**
 * The same moment as a clock time in the school's zone, from the meeting's own
 * `local.start` ('07:00' -> '06:30'), or '' without one.
 */
export function checkInOpensClock(local) {
  const match = /^(\d{2}):(\d{2})$/.exec(local?.start ?? '');
  if (!match) return '';
  const minutes = (Number(match[1]) * 60 + Number(match[2]) - CHECK_IN_EARLY_MS / 60000 + 24 * 60) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * What one of today's meetings shows:
 *
 *   cancelled   not held — `cancelReason` says why
 *   final       the teacher confirmed; `attendance.status` is the record
 *   checkedIn   the student checked in; waiting for the teacher
 *   open        check-in is taken now
 *   upcoming    check-in not open yet (it opens 30 minutes before the start)
 *   missed      over, no check-in, the teacher has not confirmed yet
 *   confirmed   the teacher confirmed and there is no record for this student
 *               (placed in the Class after the meeting began)
 *   noLocation  check-in window open, but the school has no point: the teacher
 *               records it
 *   otherClass  a meeting of the Class the student left today
 *   waiting     the window is open by this device's clock but was not by the
 *               server's when it last answered: read again shortly
 *
 * @param {object} session  one of `sessions` from sessionsService.mine
 * @param {{ now?: Date, hasLocation?: boolean, className?: string|null }} context
 *   `hasLocation` from `/users/me` (`school.hasLocation`) — false only when known;
 *   `className` the student's Class now, from the same answer.
 */
export function rowState(session, { now = new Date(), hasLocation, className } = {}) {
  if (session.status !== 'SCHEDULED') return 'cancelled';
  if (session.attendance) return session.completedAt ? 'final' : 'checkedIn';
  if (session.completedAt) return 'confirmed';

  const end = new Date(session.endsAt);
  if (now >= end) return 'missed';
  /* The server's word first: a device clock a minute slow must not hide the button. */
  if (session.canCheckIn) return 'open';
  if (now < checkInOpensAt(session)) return 'upcoming';
  if (hasLocation === false) return 'noLocation';
  if (className && session.class !== className) return 'otherClass';
  return 'waiting';
}

const byStart = (a, b) => new Date(a.startsAt) - new Date(b.startsAt) || a.number - b.number;

/**
 * The dashboard's one meeting (owner, 2026-10-03): what is on now, else what is
 * next — not the whole day stacked. Cancelled meetings are passed over.
 *
 *   now        running by this clock, or open by the server's. Two at once
 *              happens only on a class-move day (listMine shows a meeting for
 *              both placements); the one taking a check-in wins, then the
 *              earliest. Shown until it ends, checked in or not.
 *   next       the earliest not begun
 *   done       every meeting is over — `total` held, `checkedIn` of them
 *   cancelled  none held today
 *
 * `others` is how many of the day's meetings are not the one shown.
 */
export function focusOf(sessions, context = {}) {
  const now = context.now ?? new Date();
  const all = sessions?.length ?? 0;
  const held = (sessions ?? []).filter((session) => session.status === 'SCHEDULED').sort(byStart);
  if (held.length === 0) return { kind: 'cancelled', session: null, others: all };

  const stateOf = (session) => rowState(session, { ...context, now });
  const running = held.filter(
    (session) =>
      stateOf(session) === 'open' || (new Date(session.startsAt) <= now && now < new Date(session.endsAt))
  );
  if (running.length > 0) {
    const pick = running.find((session) => stateOf(session) === 'open') ?? running[0];
    return { kind: 'now', session: pick, others: all - 1 };
  }

  const next = held.find((session) => new Date(session.startsAt) > now);
  if (next) return { kind: 'next', session: next, others: all - 1 };

  return {
    kind: 'done',
    session: null,
    others: all,
    total: held.length,
    checkedIn: held.filter((session) => session.attendance?.checkedInAt).length,
  };
}

const SECOND = 1000;
const WAITING_RETRY = 15 * SECOND;
const LONGEST_WAIT = 6 * 60 * 60 * SECOND;

/**
 * How long until the card should read again, in ms — or null when nothing on it
 * can change by the clock alone. The next check-in opening, start or end of a
 * meeting, a second after it so the server agrees; sooner while a row is
 * `waiting`.
 */
export function nextReadIn(sessions, context = {}) {
  const now = context.now ?? new Date();
  let soonest = null;
  for (const session of sessions ?? []) {
    if (session.status !== 'SCHEDULED' || session.completedAt) continue;
    for (const edge of [checkInOpensAt(session), new Date(session.startsAt), new Date(session.endsAt)]) {
      const wait = edge.getTime() - now.getTime();
      if (wait > 0 && (soonest === null || wait < soonest)) soonest = wait;
    }
    if (rowState(session, { ...context, now }) === 'waiting') {
      soonest = soonest === null ? WAITING_RETRY : Math.min(soonest, WAITING_RETRY);
    }
  }
  if (soonest === null) return null;
  return Math.min(soonest + SECOND, LONGEST_WAIT);
}

/** A failure to read the device's position, by `reason`. */
export class PositionError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'PositionError';
    this.reason = reason;
  }
}

/*
  The browser's GeolocationPositionError codes: 1 denied, 2 unavailable,
  3 timeout. A fresh reading every time (maximumAge 0): a position cached from
  the way to school would place the student at the bus stop.
*/
const REASON_BY_CODE = { 1: 'denied', 2: 'unavailable', 3: 'timeout' };

/**
 * Where the device is: `{ latitude, longitude }`. Rejects with a PositionError —
 * `insecure` (geolocation needs https or localhost), `unsupported`, `denied`,
 * `unavailable` or `timeout`. Both arguments are there for the tests.
 */
export function readPosition(geolocation = globalThis.navigator?.geolocation, secure = globalThis.isSecureContext) {
  return new Promise((resolve, reject) => {
    if (secure === false) return reject(new PositionError('insecure'));
    if (!geolocation?.getCurrentPosition) return reject(new PositionError('unsupported'));
    geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      (error) => reject(new PositionError(REASON_BY_CODE[error?.code] ?? 'unavailable')),
      { enableHighAccuracy: true, timeout: 20 * SECOND, maximumAge: 0 }
    );
  });
}

/**
 * Today's row with the check-in the server answered (its `attendance`), so the
 * card shows it at once without reading the whole day again.
 */
export function withCheckIn(day, sessionId, attendance) {
  if (!day) return day;
  return {
    ...day,
    sessions: day.sessions.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            canCheckIn: false,
            attendance: {
              id: attendance.id,
              status: attendance.status,
              checkedInAt: attendance.checkedInAt,
              outsideSchool: attendance.outsideSchool,
              late: attendance.late,
            },
          }
        : session
    ),
  };
}
