import React from 'react';

import AuthLayout from '../../layouts/AuthLayout';
import Button from '../../components/ui/Button';
import { useT } from '../../i18n/LanguageContext';
import { mainUrl, schoolAddressOf } from '../../constants/subdomain';
import { usePlace } from '../../context/PlaceContext';

/*
  A school address nobody uses, or a school switched off (backend a577abd answers
  both with the same 404, owner 2026-10-22 E7): said, with the way to the main
  domain, and no form - signing in here would be refused anyway.

  The card follows /verify-email's failed state (owner, 2026-10-29, mockup
  alamat-tidak-dipakai.html): a rose tile, a one-colour title, and the address
  in a box of its own - a long label used to cut the sentence it sat in.
*/
export const UnknownPlacePage = () => {
  const { t } = useT();
  const { label } = usePlace();
  const address = schoolAddressOf(label);
  return (
    <AuthLayout heading={t('place.unknown.panel')} blurb={t('place.unknown.blurb')}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-sm bg-rose-50 text-rose-600">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
      </div>
      <div>
        <h2 className="text-[26px] font-extrabold text-slate-800 leading-tight select-none">{t('place.unknown.title')}</h2>
        <p className="text-slate-500 text-sm mt-2 font-medium">{t('place.unknown.body')}</p>
      </div>
      {address && (
        <div className="border border-slate-200 rounded-2xl px-4 py-3 text-left">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('place.unknown.address')}</p>
          <p className="text-sm font-bold text-slate-800 mt-0.5 break-all">{address}</p>
        </div>
      )}
      <Button onClick={() => window.location.assign(mainUrl('/login'))} className="w-full">
        {t('place.unknown.toMain')}
      </Button>
    </AuthLayout>
  );
};

export default UnknownPlacePage;
