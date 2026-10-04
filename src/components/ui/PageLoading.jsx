import React from 'react';
import { Loader2 } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';

/*
  What shows while a page's code is still on its way (owner, 2026-10-04): every
  page is its own chunk now (React.lazy in App.jsx), fetched the first time it is
  opened. Inside a layout it fills the content area only, so the sidebar and
  navbar stay put; `fullScreen` is for the signed-out pages, which have no shell.
*/
export const PageLoading = ({ fullScreen = false }) => {
  const { t } = useT();
  return (
    <div
      className={`flex items-center justify-center ${fullScreen ? 'min-h-dvh bg-canvas' : 'py-24'}`}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="w-6 h-6 text-brand animate-spin" aria-hidden="true" />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
};

export default PageLoading;
