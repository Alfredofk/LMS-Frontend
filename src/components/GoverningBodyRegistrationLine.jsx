import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { governingBodyService } from '../services/governingBodyService';
import { useT } from '../i18n/LanguageContext';
import { registrationLineOf } from '../views/Role/bodyRegistration';

/*
  The way to register a yayasan, perkumpulan or dinas (backend b5cfffd; owner
  2026-10-24): one line under the cards on /select-role and in My Profile's "Sekolah
  lain", never a card. The line is the registration's state too, from this
  account's newest (`GET /governing-body-registrations/mine`): under review, or
  turned down with the reviewer's words and a way to register again; otherwise -
  none yet, or approved, whose body is then one of the places - the link.

  The caller shows it only to somebody who is no student anywhere (`mayJoinAnother`),
  as the server refuses a student. A read that fails leaves the link.
*/
export const GoverningBodyRegistrationLine = ({ className = '' }) => {
  const { t } = useT();
  const [line, setLine] = useState(null);

  useEffect(() => {
    let cancelled = false;
    governingBodyService
      .listMine()
      .then((mine) => !cancelled && setLine(registrationLineOf(mine)))
      .catch(() => !cancelled && setLine(registrationLineOf([])));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!line) return null;

  const link = (key) => (
    <Link to="/get-started/governing-body" className="font-extrabold text-brand hover:text-brand-deep underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded">
      {t(key)}
    </Link>
  );

  return (
    <div className={`text-xs font-semibold leading-relaxed text-left ${className}`}>
      {line.state === 'WAITING' && <p className="text-amber-700 break-words">{t('gbreg.line.waiting', { name: line.name })}</p>}
      {line.state === 'REJECTED' && (
        <>
          <p className="text-rose-700 break-words">{t('gbreg.line.rejected', { name: line.name })}</p>
          {line.reason && <p className="text-slate-600 break-words mt-0.5">{t('others.reason', { reason: line.reason })}</p>}
          <p className="mt-1">{link('gbreg.line.again')}</p>
        </>
      )}
      {line.state === 'OPEN' && (
        <p className="text-slate-500">
          {t('gbreg.line.question')} {link('gbreg.line.link')}
        </p>
      )}
    </div>
  );
};

export default GoverningBodyRegistrationLine;
