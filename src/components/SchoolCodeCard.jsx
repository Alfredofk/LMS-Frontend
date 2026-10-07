import React, { useEffect, useState } from 'react';
import { KeyRound, Copy, Check, RefreshCw } from 'lucide-react';

import ConfirmDialog from './ui/ConfirmDialog';
import { schoolService } from '../services/schoolService';
import { useT } from '../i18n/LanguageContext';
import { apiErrorMessage } from '../i18n/apiError';
import { useAuth } from '../context/AuthContext';
import { ROLES, activeRolesOf } from '../constants/roles';

const COPIED_MS = 2000;

/*
  Copying, with the fallback that matters here.

  `navigator.clipboard` exists only in a **secure context** — https, localhost or
  file. The app is tested from a phone over `http://10.20.x.x:5173`, where the
  whole API is `undefined`, and that is precisely where somebody wants to paste a
  code into WhatsApp. Calling it there throws, on the one device the button was
  added for.

  `document.execCommand('copy')` is deprecated and is the only thing that works
  over plain http. So the modern path is tried first and the old one catches
  everything it cannot do.
*/
const copyText = async (text) => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* Refused, or an insecure context that exposed the API anyway. Fall
         through rather than reporting a failure we have not had yet. */
    }
  }

  try {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.top = '-1000px';
    field.style.opacity = '0';
    document.body.appendChild(field);

    field.select();
    /* iOS Safari ignores select() on a readonly field without this. */
    field.setSelectionRange(0, text.length);

    const ok = document.execCommand('copy');
    document.body.removeChild(field);
    return ok;
  } catch {
    return false;
  }
};

/*
  The **School Code**, the one number to hand out: eight characters somebody types
  to ask to join. The school's NPSN, which is never handed out, moved to the
  profile header beside NIP and NUPTK (owner, 2026-10-07): sitting between this
  card's title and the code, it read as if it too were to be given away.

  Founding a school generates a code and nothing ever showed it — so a principal
  had nothing to give the teachers and students who need one to join, and the
  whole join flow had no way to start.

  **It decides for itself whether it has anything to say.** The code comes from
  `/users/me` (`membership.school.schoolCode`, backend 1bd81ab), which carries it
  to those who hand it out - the Principal, a Vice Principal, the homeroom teacher
  of a class in an active year - and null to everybody else; this renders `null`
  then, so no caller has to ask. Each of the three is told who to give it to
  (owner, 2026-10-04). Replacing it stays the Principal's. Before 1bd81ab
  `GET /school-registrations/mine` was the only source of the code, and a second
  Principal could not read it at all.

  **One place shows it: My Profile.** It began on three screens, lost the
  join-requests queue, then the dashboard. A School Code is handed out in a burst
  when people join and barely touched afterwards — reference data, not work — and
  a dashboard is where the work is. My Profile is one click from every signed-in
  screen through the pinned Account group, and again through the sidebar card, so
  the copies were buying almost nothing.

  ## Replacing a code that has spread

  Backend `60ea459` added `POST /api/school/code/rotate`. A code sent to one
  class's WhatsApp group ends up in others; this is how the Principal takes it
  back. The button is quieter than Copy on purpose — copying is what the card is
  for, replacing is rare and cannot be undone — and it asks first, naming the code
  that is about to stop working.

  The new code is taken from the answer rather than refetched: the answer already
  carries it, and a second request would only open a window in which the card
  shows the dead one.

  Two refusals get their own sentences. NOT_FOUND here does not mean "not found"
  — the backend answers it for a school that has been switched off — and
  FORBIDDEN has no sentence in the shared map at all, so it would otherwise arrive
  in the server's English.

  Deliberately **not** a `components/ui/` primitive: it fetches. Those are all
  presentational, and it sits beside `ProtectedRoute.jsx` instead.
*/

const ROTATE_ERRORS = {
  NOT_FOUND: 'schoolCode.rotate.deactivated',
  FORBIDDEN: 'schoolCode.rotate.forbidden',
};
export const SchoolCodeCard = () => {
  const { t } = useT();

  const { membership, refreshMe } = useAuth();
  const held = activeRolesOf(membership);
  const principal = held.includes(ROLES.PRINCIPAL);
  const vice = held.includes(ROLES.VICE_PRINCIPAL);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [rotated, setRotated] = useState(false);
  const [rotateError, setRotateError] = useState(null);
  /* The code a rotation just answered, ahead of the next /users/me. */
  const [rotatedCode, setRotatedCode] = useState(null);

  const code = rotatedCode ?? membership?.school?.schoolCode ?? null;
  const unknown = Boolean(membership?.school) && membership.school.schoolCode === undefined;

  /* A membership cached from sign-in may not carry the code yet: read /users/me once. */
  useEffect(() => {
    if (unknown) refreshMe().catch(() => {});
  }, [unknown, refreshMe]);

  /* The label goes back on its own; nothing here is waiting on the answer. */
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!code) return null;

  /* The code alone. */
  const handleCopy = async () => {
    if (await copyText(code)) setCopied(true);
  };

  const handleRotate = async () => {
    setRotating(true);
    setRotateError(null);
    try {
      const fresh = await schoolService.rotateCode();
      if (fresh?.schoolCode) {
        setRotatedCode(fresh.schoolCode);
        refreshMe().catch(() => {});
        /* "Copied" described the old code. */
        setCopied(false);
        setRotated(true);
      }
    } catch (err) {
      setRotated(false);
      setRotateError(apiErrorMessage(err, t, ROTATE_ERRORS));
    } finally {
      setRotating(false);
      setConfirming(false);
    }
  };

  return (
    <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-slate-500">
          <KeyRound className="w-4 h-4 shrink-0" aria-hidden="true" />
          <h2 className="text-[11px] font-bold uppercase tracking-wider">{t('schoolCode.title')}</h2>
        </div>

        {/*
          Selectable on purpose. If both copy paths fail — an old browser on plain
          http — somebody can still select the code by hand, which is why this is
          text rather than an image or a canvas.
        */}

        <p className="mt-1.5 text-2xl sm:text-3xl font-extrabold font-mono tracking-[0.2em] text-slate-900 select-all break-all">
          {code}
        </p>
        <p className="mt-1 text-[11px] font-semibold text-slate-500 leading-relaxed">
          {t(principal ? 'schoolCode.hint.principal' : vice ? 'schoolCode.hint.vice' : 'schoolCode.hint.homeroom')}
        </p>


        {rotated && (
          <p className="mt-2 text-xs font-semibold text-emerald-700" role="status">
            {t('schoolCode.rotate.done')}
          </p>
        )}
        {rotateError && (
          <p className="mt-2 text-xs font-semibold text-rose-600" role="alert">
            {rotateError}
          </p>
        )}
      </div>

      <div className="shrink-0 flex flex-col sm:items-end gap-2">
        <button
          type="button"
          onClick={handleCopy}
          aria-label={t('schoolCode.copy.aria')}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300 text-xs font-extrabold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden="true" />
              {t('schoolCode.copied')}
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />
              {t('schoolCode.copy')}
            </>
          )}
        </button>

        {principal && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={rotating}
            className="inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold text-slate-500 hover:text-brand transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-default"
          >
            <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {t('schoolCode.rotate')}
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        tone="brand"
        title={t('schoolCode.rotate.title')}
        body={t('schoolCode.rotate.body', { code })}
        confirmLabel={t('schoolCode.rotate.confirm')}
        cancelLabel={t('common.cancel')}
        busy={rotating}
        busyLabel={t('schoolCode.rotate.busy')}
        onConfirm={handleRotate}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
};

export default SchoolCodeCard;
