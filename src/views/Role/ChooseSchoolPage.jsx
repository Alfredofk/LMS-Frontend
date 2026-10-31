import React, { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ChevronRight, Loader2 } from 'lucide-react';

import AuthLayout from '../../layouts/AuthLayout';
import FactLine from '../../components/ui/FactLine';
import { Initials } from '../GoverningBody/bodyParts';
import AuthMessageIcon from '../../components/ui/AuthMessageIcon';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { placesErrorMessage } from '../../i18n/apiError';
import { signedInHome } from '../../constants/roles';
import { hasGoverningBody, openPlaceOf, placeRoleKeysOf, samePlace, waitingRequestsOf } from '../../constants/places';

/*
  "Pilih sekolah" (/choose-school; owner, 2026-10-22; backend 72e546b): where a
  sign-in lands when the person may open several schools and none was remembered on
  this device - the first time, or when the remembered one no longer opens. One card
  per school (its name and the roles held there); a click opens it
  (AuthContext.openPlace: its own address through a handoff when school addresses
  are in use, else `POST /auth/place` here), remembers it, and enters its default
  role's home. Requests still waiting at other schools are named under the cards.

  A Governing Body seat (backend b5cfffd) is a card too, "Admin yayasan" under its
  name, and while one is listed the page says "sekolah atau yayasan" (owner,
  2026-10-24).

  Read again on arrival (/users/me): somebody who no longer has a choice - one school
  left, or a school already open - goes on to where they belong instead.
*/

export const ChooseSchoolPage = () => {
  const { user, membership, governingBody, roles, activeRole, isPlatformAdmin, places, otherSchools, refreshMe, openPlace, logout } = useAuth();
  const { t } = useT();

  const asked = useRef(false);
  const [checked, setChecked] = useState(false);
  const [opening, setOpening] = useState(null);
  const [error, setError] = useState(null);
  const [sessionEnded, setSessionEnded] = useState(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    refreshMe()
      .catch(() => {})
      .finally(() => setChecked(true));
  }, [refreshMe]);

  if (checked && (places.length < 2 || openPlaceOf({ membership, governingBody }))) {
    return <Navigate to={signedInHome({ roles, activeRole, isPlatformAdmin, governingBody })} replace />;
  }

  /* The words say "sekolah atau yayasan" only while a Governing Body is listed. */
  const withBody = hasGoverningBody(places);
  const words = (key) => t(withBody ? `${key}.withBody` : key);

  const open = async (place) => {
    setOpening(place);
    setError(null);
    setSessionEnded(false);
    try {
      /* Leaves the page: to the place's own address (a handoff) or a fresh load here. */
      await openPlace(place);
    } catch (err) {
      setError(placesErrorMessage(err, t, place));
      setOpening(null);
      /* A 401 is a spent sign-in: reading the list again would only fail the same way. */
      if (err?.status === 401) setSessionEnded(true);
      else refreshMe().catch(() => {});
    }
  };

  const waiting = waitingRequestsOf(null, otherSchools);

  const footer = (
    <button
      type="button"
      onClick={logout}
      className="text-xs text-slate-500 hover:text-brand font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded cursor-pointer"
    >
      {t('shell.logOut')}
    </button>
  );

  return (
    <AuthLayout heading={words('choose.panel.heading')} blurb={words('choose.panel.blurb')} footer={footer}>
      <div>
        <h2 className="text-[26px] font-extrabold text-slate-800 leading-tight select-none">{words('choose.title')}</h2>
        <FactLine facts={[user?.fullName, t(withBody ? 'choose.count.withBody' : 'choose.count', { n: places.length })]} wrap className="mt-2" />
      </div>

      {!checked ? (
        <div className="h-40 rounded-2xl bg-slate-50 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />
      ) : (
        <ul className="space-y-3 text-left">
          {places.map((place) => (
            <li key={`${place.kind}:${place.id}`}>
              <button
                type="button"
                onClick={() => open(place)}
                disabled={opening !== null}
                className={`group w-full flex items-center justify-between gap-3 p-4 text-left rounded-2xl border bg-white hover:border-brand hover:bg-brand-tint/40 transition-colors cursor-pointer disabled:cursor-wait focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  samePlace(opening, place) ? 'border-brand bg-brand-tint/40' : 'border-slate-200 disabled:opacity-60'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Initials name={place.name} />
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold text-slate-900 break-words">{place.name}</span>
                    <span className="block text-xs font-semibold text-slate-500 mt-0.5">
                      {samePlace(opening, place) ? t('choose.opening') : placeRoleKeysOf(place).map((key) => t(key)).join(', ')}
                    </span>
                  </span>
                </span>
                {samePlace(opening, place) ? (
                  <Loader2 className="w-4 h-4 text-brand shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 text-left flex items-start gap-2.5" role="alert">
          <AuthMessageIcon tone="error" />
          <div className="space-y-2">
            <span className="block">{error}</span>
            {/* A 401 here means the sign-in itself is spent: the only way on is signing in again. */}
            {sessionEnded && (
              <button
                type="button"
                onClick={logout}
                className="font-extrabold text-rose-700 underline underline-offset-2 hover:text-rose-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded cursor-pointer"
              >
                {t('choose.signInAgain')}
              </button>
            )}
          </div>
        </div>
      )}

      {waiting.length > 0 && (
        <p className="text-xs font-semibold text-slate-500 text-left leading-relaxed">
          {t('choose.waiting', { schools: waiting.map((entry) => entry.schoolName).join(', ') })}
        </p>
      )}
    </AuthLayout>
  );
};

export default ChooseSchoolPage;
