import React from 'react';
import { Bell, Megaphone, Pin, Wrench } from 'lucide-react';

import { useT } from '../../../i18n/LanguageContext';
import { formatDay } from '../../Classes/format';

/*
  The announcements a teacher, the Principal or a Vice Principal pinned, at the
  top of the student's dashboard, above today's schedule (owner, 2026-10-03).
  One that is not pinned goes only to the notifications behind the bell, and the
  old "School announcements" widget at the foot of the page went.

  Each is a small card, never one long line, two side by side from 640px.

  There is no announcement model or route in the backend yet (bf6e9b5), so this
  renders `notBuilt` until there is; then pass `items`:
  [{ id, title, body, authorName, authorRole, createdAt }], pinned ones only.
*/
export const PinnedAnnouncements = ({ items = [], notBuilt = false }) => {
  const { t, lang } = useT();

  return (
    <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm" aria-labelledby="pinned-title">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-brand-tint text-brand flex items-center justify-center shrink-0">
            <Megaphone className="w-4.5 h-4.5" aria-hidden="true" />
          </span>
          <h2 id="pinned-title" className="text-base font-extrabold text-slate-800 tracking-tight">
            {t('dash.pinned.title')}
          </h2>
        </div>
        {notBuilt && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-extrabold">
            <Wrench className="w-3 h-3" aria-hidden="true" />
            {t('common.notBuilt.title')}
          </span>
        )}
      </div>

      {notBuilt || items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 flex flex-col sm:flex-row sm:items-center gap-3 text-left">
          <span className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center shrink-0">
            <Pin className="w-5 h-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-extrabold text-slate-700">{t('dash.pinned.empty')}</p>
            <p className="text-[11px] font-semibold text-slate-500 leading-relaxed flex items-start gap-1.5">
              <Bell className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
              {t('dash.pinned.howItWorks')}
            </p>
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl border border-brand/20 bg-brand-tint/40 p-4 space-y-2">
              <div className="flex items-start gap-2">
                <Pin className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-label={t('dash.pinned.pinned')} />
                <h3 className="text-sm font-extrabold text-slate-800 break-words">{item.title}</h3>
              </div>
              <p className="text-xs font-medium text-slate-600 leading-relaxed line-clamp-3 break-words">{item.body}</p>
              <p className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                <span className="px-1.5 py-0.5 rounded-md bg-white text-slate-700">{item.authorName}</span>
                {item.authorRole && (
                  <span className="px-1.5 py-0.5 rounded-md bg-brand-tint text-brand">{t(`roleTitle.${item.authorRole}`)}</span>
                )}
                <span className="px-1.5 py-0.5 rounded-md bg-white text-slate-500">{formatDay(item.createdAt, lang)}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default PinnedAnnouncements;
