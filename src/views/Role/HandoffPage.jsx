import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import AuthLayout from '../../layouts/AuthLayout';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { signedInHome } from '../../constants/roles';
import { handoffCodeOf } from '../../constants/subdomain';
import { usePlace } from '../../context/PlaceContext';

/*
  /handoff, on a school's own address (backend a577abd; owner 2026-10-22 E2/E6): the
  arrival end of moving a sign-in between schools. The code travels after `#`, so it
  never reaches a server log or a Referer; it is read once and wiped from the address
  bar before anything else happens, then traded for a sign-in here
  (AuthContext.redeemHandoff) and the person enters the school's default role's home.
  A code used, expired, or of a sign-in ended since (one 401) is said, with the way
  to sign in here.
*/
export const HandoffPage = () => {
  const navigate = useNavigate();
  const { t } = useT();
  const { redeemHandoff } = useAuth();
  const { place } = usePlace();
  const started = useRef(false);
  /* Read once, before the address bar is wiped below. */
  const [code] = useState(() => handoffCodeOf(window.location.hash));
  const [failed, setFailed] = useState(() => !code);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    window.history.replaceState(window.history.state, '', window.location.pathname);
    if (!code) return;
    redeemHandoff(code)
      .then((session) => navigate(signedInHome(session), { replace: true }))
      .catch(() => setFailed(true));
  }, [code, navigate, redeemHandoff]);

  const school = place?.name;

  /* The card follows the verify-email page (owner, 2026-10-29, mockup
     pindah-sekolah.html): a tile over a one-colour title. The half purple bar
     that pulsed here looked like 50% done while measuring nothing. */
  return (
    <AuthLayout
      transitionKey={failed ? 'failed' : 'opening'}
      heading={school ?? t('handoff.panel')}
      blurb={t(failed ? 'handoff.failed.blurb' : 'handoff.blurb')}
    >
      {failed ? (
        <>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-sm bg-rose-50 text-rose-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <h2 className="text-[26px] font-extrabold text-slate-800 leading-tight select-none">{t('handoff.failed.title')}</h2>
            <p className="text-slate-500 text-sm mt-2 font-medium">{t('handoff.failed.body')}</p>
          </div>
          <Button onClick={() => navigate('/login', { replace: true })} className="w-full">
            {school ? t('handoff.failed.signInTo', { school }) : t('handoff.failed.signIn')}
          </Button>
        </>
      ) : (
        <div role="status" aria-busy="true" className="space-y-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-sm bg-brand-tint text-brand">
            <Loader2 className="w-7 h-7 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-[26px] font-extrabold text-slate-800 leading-tight select-none">
              {school ? t('handoff.openingSchool', { school }) : t('handoff.opening')}
            </h2>
            <p className="text-slate-500 text-sm mt-2 font-medium">{t('handoff.wait')}</p>
          </div>
        </div>
      )}
    </AuthLayout>
  );
};

export default HandoffPage;
