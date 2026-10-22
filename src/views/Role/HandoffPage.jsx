import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

  return (
    <AuthLayout heading={place?.name ?? t('handoff.panel')} blurb={t(failed ? 'handoff.failed.blurb' : 'handoff.blurb')}>
      {failed ? (
        <>
          <div>
            <h2 className="text-3xl sm:text-[34px] font-extrabold text-brand leading-tight select-none">{t('handoff.failed.title')}</h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-2 font-semibold">{t('handoff.failed.body')}</p>
          </div>
          <Button onClick={() => navigate('/login', { replace: true })} className="w-full">
            {t('handoff.failed.signIn')}
          </Button>
        </>
      ) : (
        <div role="status" aria-busy="true">
          <h2 className="text-3xl sm:text-[34px] font-extrabold text-brand leading-tight select-none">{t('handoff.opening')}</h2>
          <div className="mt-6 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full w-1/2 bg-brand/40 animate-pulse" />
          </div>
        </div>
      )}
    </AuthLayout>
  );
};

export default HandoffPage;
