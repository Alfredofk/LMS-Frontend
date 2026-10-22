import React from 'react';

import AuthLayout from '../../layouts/AuthLayout';
import Button from '../../components/ui/Button';
import { useT } from '../../i18n/LanguageContext';
import { mainUrl } from '../../constants/subdomain';
import { usePlace } from '../../context/PlaceContext';

/*
  A school address nobody uses, or a school switched off (backend a577abd answers
  both with the same 404, owner 2026-10-22 E7): said, with the way to the main
  domain, and no form - signing in here would be refused anyway.
*/
export const UnknownPlacePage = () => {
  const { t } = useT();
  const { label } = usePlace();
  return (
    <AuthLayout heading={t('place.unknown.panel')} blurb={t('place.unknown.blurb')}>
      <div>
        <h2 className="text-3xl sm:text-[34px] font-extrabold text-brand leading-tight select-none">{t('place.unknown.title')}</h2>
        <p className="text-slate-500 text-xs sm:text-sm mt-2 font-semibold break-words">{t('place.unknown.body', { label: label ?? '' })}</p>
      </div>
      <Button onClick={() => window.location.assign(mainUrl('/login'))} className="w-full">
        {t('place.unknown.toMain')}
      </Button>
    </AuthLayout>
  );
};

export default UnknownPlacePage;
