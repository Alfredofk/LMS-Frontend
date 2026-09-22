import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { activeStore } from '../../services/apiClient';
import { ROLE_LABEL_KEY, GET_STARTED_PATH } from '../../constants/roles';
import { useT } from '../../i18n/LanguageContext';

/*
  Being turned down, said out loud once.

  A rejection used to reach somebody as a line of small grey text on a card they
  might not look at, in the slot where that card's fixed tagline normally sits.
  Somebody who registered a school and had it refused would come back, see
  "Jelek nama sekolahnya" under the word Organization, and have to work out both
  what had happened and what to do next.

  So it is announced: what was refused, the reviewer's own words for why, and the
  one thing worth offering — try again. `assertSchoolRegistrationAllowed`
  (`shared/approval.js:118`) permits it; only a registration still under review
  blocks a new one, plus a ceiling of three submissions per 24 hours.

  ## Once per rejection, not once per visit

  "Maybe later" that means "in five seconds" is a promise broken, and a dialog
  that reappears is one people learn to dismiss without reading. So the id of the
  thing that was rejected is remembered, and a **new** rejection — a fresh
  registration, a fresh join request — is a new id and speaks again.

  The memory lives in `activeStore()`, the same place the session does, because
  it belongs to this person rather than to this machine. On a shared computer
  without "Remember me" it dies with the tab, and they are told once more next
  time. That is the right way round: a new session is a new chance to notice.

  ## Both kinds, one dialog

  A refused school registration and a refused join request are the same event
  wearing different words, and `/users/me` reports the second per role as
  `{ role, status, rejectionReason }`. Handling one and not the other would leave
  the teacher who was turned down reading small grey text again.
*/

const SEEN_KEY = 'lms_seen_rejections';

/* A short tail is enough: this only has to stop the dialog repeating, and an
   id that falls off the end belongs to a decision made long ago. */
const REMEMBER_LAST = 20;

const readSeen = () => {
  try {
    const raw = activeStore().getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    /* Private mode, blocked storage, or something that is not JSON. Treating it
       as "nothing seen" shows the dialog again, which is the harmless way to be
       wrong. */
    return [];
  }
};

const remember = (id) => {
  try {
    const next = [...new Set([...readSeen(), id])].slice(-REMEMBER_LAST);
    activeStore().setItem(SEEN_KEY, JSON.stringify(next));
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
const rejectionsOf = (membership, registration) => {
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

  for (const entry of membership?.roles ?? []) {
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

export const RejectionNotice = ({ membership, registration }) => {
  const navigate = useNavigate();
  const { t } = useT();

  /*
    Derived, not an effect.

    What to show follows entirely from the props plus what has been dismissed, so
    computing it during render is both simpler and correct. Doing it in an effect
    would mean a `setState` inside one — the lint rule that catches that is right:
    the first paint would show nothing and a second would show the dialog, which
    is a flash for no reason.

    `readSeen()` runs once, through the lazy initialiser: storage is read on mount
    and every dismissal after that is remembered in both places at once.
  */
  const [dismissed, setDismissed] = useState(readSeen);

  const shown = rejectionsOf(membership, registration).find(
    (item) => !dismissed.includes(item.id)
  );

  if (!shown) return null;

  const close = () => {
    remember(shown.id);
    setDismissed((prev) => [...prev, shown.id]);
  };

  const tryAgain = () => {
    remember(shown.id);
    navigate(shown.next);
  };

  const title = shown.role
    ? t(shown.titleKey, { role: t(ROLE_LABEL_KEY[shown.role]) })
    : t(shown.titleKey);

  return (
    <ConfirmDialog
      open
      title={title}
      body={
        <>
          {shown.reason ? t('rejected.lead') : t('rejected.noReason')}
          {shown.reason && (
            /* A span, not a div: this renders inside the dialog's <p>. */
            <span className="block mt-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-slate-700 font-semibold break-words">
              {shown.reason}
            </span>
          )}
        </>
      }
      confirmLabel={t(shown.againKey)}
      cancelLabel={t('rejected.later')}
      /* Brand, not danger: the button offers another go, it does not destroy
         anything. The bad news is the title's job. */
      tone="brand"
      onCancel={close}
      onConfirm={tryAgain}
    />
  );
};

export default RejectionNotice;
