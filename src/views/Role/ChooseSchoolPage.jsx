import React, { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

import AuthLayout from '../../layouts/AuthLayout';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { placesErrorMessage } from '../../i18n/apiError';
import { signedInHome } from '../../constants/roles';
import { placeRolesOf, waitingRequestsOf } from '../../constants/places';

/*
  "Pilih sekolah" (/choose-school; owner, 2026-10-22; backend 72e546b): where a
  sign-in lands when the person may open several schools and none was remembered on
  this device - the first time, or when the remembered one no longer opens. One card
  per school (its name and the roles held there); a click opens it
  (AuthContext.openSchool: its own address through a handoff when school addresses
  are in use, else `POST /auth/place` here), remembers it, and enters its default
  role's home. Requests still waiting at other schools are named under the cards.

  Read again on arrival (/users/me): somebody who no longer has a choice - one school
  left, or a school already open - goes on to where they belong instead.
*/

export const ChooseSchoolPage = () => {
  const { user, membership, roles, activeRole, isPlatformAdmin, places, otherSchools, refreshMe, openSchool, logout } = useAuth();
  const { t } = useT();

  const asked = useRef(false);
  const [checked, setChecked] = useState(false);
  const [opening, setOpening] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    refreshMe()
      .catch(() => {})
      .finally(() => setChecked(true));
  }, [refreshMe]);

  if (checked && (places.length < 2 || membership?.school?.id || membership?.schoolId)) {
    return <Navigate to={signedInHome({ roles, activeRole, isPlatformAdmin })} replace />;
  }

  const open = async (schoolId) => {
    setOpening(schoolId);
    setError(null);
    try {
      /* Leaves the page: to the school's own address (a handoff) or a fresh load here. */
      await openSchool(schoolId);
    } catch (err) {
      setError(placesErrorMessage(err, t));
      setOpening(null);
      refreshMe().catch(() => {});
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
    <AuthLayout heading={t('choose.panel.heading')} blurb={t('choose.panel.blurb')} footer={footer}>
      <div>
        <h2 className="text-3xl sm:text-[34px] font-extrabold text-brand leading-tight select-none">{t('choose.title')}</h2>
        <p className="text-slate-500 text-xs sm:text-sm mt-2 font-semibold">
          {t('choose.subtitle')}
          {user?.fullName ? ` (${user.fullName})` : ''}
        </p>
      </div>

      {!checked ? (
        <div className="h-40 rounded-2xl bg-slate-50 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />
      ) : (
        <ul className="space-y-3 text-left">
          {places.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => open(place.id)}
                disabled={opening !== null}
                className="w-full flex items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 bg-white hover:border-brand hover:bg-brand-tint/40 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-extrabold text-slate-900 break-words">{place.name}</span>
                  <span className="block text-xs font-semibold text-slate-500 mt-0.5">
                    {opening === place.id ? t('choose.opening') : placeRolesOf(place).map((role) => t(`roleTitle.${role}`)).join(', ')}
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="text-sm font-semibold text-rose-700 text-left" role="alert">
          {error}
        </p>
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
