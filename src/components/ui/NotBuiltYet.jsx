import React from 'react';
import { Wrench } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';

/*
  What a screen shows when the endpoint behind it answers 404.

  Deliberately not red, and deliberately not the error panel. Nothing here has
  failed: the backend mounts four namespaces and this app calls thirty-seven, so
  a missing route is the expected state of most screens for now, not an incident.
  Telling somebody "Terjadi Kesalahan" for it sends them looking for a fault that
  does not exist — and trains them to ignore the panel when a real one appears.

  The distinction is made by `isNotBuiltYet` in services/apiClient.js, which is
  404 and only 404. A 500 still reaches the red panel.

  Pair it with a heading when the screen has one; this component is the body of
  an empty state, not the whole page.
*/
export const NotBuiltYet = () => {
  const { t } = useT();

  return (
    <div
      role="note"
      className="py-14 px-6 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/60 select-none"
    >
      <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto shadow-sm">
        <Wrench className="w-5 h-5 text-slate-400" aria-hidden="true" />
      </div>
      <h3 className="mt-3.5 text-sm font-extrabold text-slate-700">
        {t('common.notBuilt.title')}
      </h3>
      <p className="mt-1.5 text-xs font-semibold text-slate-500 leading-relaxed max-w-sm mx-auto">
        {t('common.notBuilt.body')}
      </p>
    </div>
  );
};

export default NotBuiltYet;
