import React, { useEffect, useState } from 'react';
import { KeyRound, Copy, Check } from 'lucide-react';

import { schoolService } from '../services/schoolService';
import { useT } from '../i18n/LanguageContext';

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
  A school's two numbers, for the person who founded it.

  The **School Code** is the one to hand out: eight characters somebody types to
  ask to join. The **NPSN** is the school's national registration number, which
  the founder typed once and may need again for something official. One is for
  giving away, the other for reading back — which is why only the first has a copy
  button.

  Founding a school generates a code and nothing ever showed it — so a principal
  had nothing to give the teachers and students who need one to join, and the
  whole join flow had no way to start.

  **It decides for itself whether it has anything to say.** The only route that
  carries either of them is `GET /school-registrations/mine`, which is keyed on
  `applicantUserId`, so it answers an empty list for anybody who did not found a
  school. This component renders `null` in that case, and on any failure, so no
  caller has to ask whether the reader founded anything. A card reading "could not
  load your code" on a page that is not about codes is noise, not an error worth
  reporting.

  **One place shows it: My Profile.** It began on three screens, lost the
  join-requests queue, then the dashboard. A School Code is handed out in a burst
  when people join and barely touched afterwards — reference data, not work — and
  a dashboard is where the work is. My Profile is one click from every signed-in
  screen through the pinned Account group, and again through the sidebar card, so
  the copies were buying almost nothing.

  The NPSN cost nothing to add: `applicantView` has always sent it and this card
  had always thrown it away, along with the city, the phone and the duration. Those
  three are still thrown away — the city is on the header card directly above, and
  nobody opens their own profile to look up their own phone number.

  Deliberately **not** a `components/ui/` primitive: it fetches. Those are all
  presentational, and it sits beside `ProtectedRoute.jsx` instead.
*/
export const SchoolCodeCard = () => {
  const { t } = useT();

  /* One object, filled by one request. Two pieces of state would invite two
     effects, and there is only one answer to wait for. */
  const [school, setSchool] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const answer = await schoolService.listMyRegistrations();
        /*
          Not `registrations[0]`, which is what SelectRolePage takes: the list is
          newest first, and a rejected retry can sit in front of the approved one
          that actually became a school. The code lives on the approved row.
        */
        const founded = (answer.registrations ?? []).find(
          (row) => row.status === 'APPROVED' && row.school?.schoolCode
        );
        if (!cancelled) {
          setSchool(
            founded
              ? { code: founded.school.schoolCode, npsn: founded.npsn ?? null }
              : null
          );
        }
      } catch {
        if (!cancelled) setSchool(null);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  /* The label goes back on its own; nothing here is waiting on the answer. */
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!school) return null;

  /* The code alone. The NPSN is not what anybody is being asked for. */
  const handleCopy = async () => {
    if (await copyText(school.code)) setCopied(true);
  };

  return (
    <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-slate-400">
          <KeyRound className="w-4 h-4 shrink-0" aria-hidden="true" />
          <h2 className="text-[11px] font-bold uppercase tracking-wider">{t('schoolCode.title')}</h2>
        </div>

        {/*
          Selectable on purpose. If both copy paths fail — an old browser on plain
          http — somebody can still select the code by hand, which is why this is
          text rather than an image or a canvas.
        */}
        <p className="mt-1.5 text-2xl sm:text-3xl font-extrabold font-mono tracking-[0.2em] text-slate-900 select-all break-all">
          {school.code}
        </p>

        {/* Absent means something else went wrong — NPSN is required at
            registration — and a blank row is not how to report that. */}
        {school.npsn && (
          <p className="mt-1 text-[11px] font-semibold text-slate-400">
            {t('schoolCode.npsn')}{' '}
            <span className="font-mono font-extrabold text-slate-600 select-all">
              {school.npsn}
            </span>
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={handleCopy}
        aria-label={t('schoolCode.copy.aria')}
        className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300 text-xs font-extrabold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
    </section>
  );
};

export default SchoolCodeCard;
