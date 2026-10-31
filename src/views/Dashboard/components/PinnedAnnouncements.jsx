import React from 'react';
import { Pin } from 'lucide-react';

import { useT } from '../../../i18n/LanguageContext';
import FactLine from '../../../components/ui/FactLine';
import { formatDay } from '../../Classes/format';
import { HomeCard } from './HomeCard';

/*
  The announcements a teacher, the Principal or a Vice Principal pinned, at the
  top of the student's dashboard, above today's schedule (owner, 2026-10-03; kept
  at the top on 2026-10-27 and again on 2026-10-31).

  There is no announcement model or route in the backend yet (bf6e9b5), so this
  renders `notBuilt` until there is; then pass `items`:
  [{ id, title, body, authorName, authorRole, createdAt }], pinned ones only.

  The look since 2026-10-31 (owner, mockup pengumuman.html items 6-8): while not
  built it is the Principal dashboard's Pengumuman card - the title, a plain grey
  "Fitur ini belum tersedia", one line - so it takes one line's height at the top
  of the page. The icon tile, the wrench, the dashed box and the sentence about
  the bell (which is not built either) went. Pinned ones are small cards, two side
  by side from 640px, the author, role and day one grey line instead of three
  chips, with "Semua pengumuman" to /announcements.
*/
export const PinnedAnnouncements = ({ items = [], notBuilt = false }) => {
  const { t, lang } = useT();

  if (notBuilt) {
    return (
      <section aria-labelledby="pinned-title" className="bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm text-left">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
          <h2 id="pinned-title" className="text-base font-extrabold text-slate-900 tracking-tight">
            {t('dash.pinned.title')}
          </h2>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">{t('common.notBuilt.title')}</span>
        </div>
        <p className="text-[13px] text-slate-500">{t('dash.pinned.soon')}</p>
      </section>
    );
  }

  return (
    <HomeCard id="pinned-title" title={t('dash.pinned.title')} linkLabel={t('dash.pinned.all')} linkTo="/announcements">
      {items.length === 0 ? (
        <p className="text-[13px] text-slate-500">{t('dash.pinned.empty')}</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl border border-brand/20 bg-brand-tint/40 p-4">
              <div className="flex items-start gap-2">
                <Pin className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-label={t('dash.pinned.pinned')} />
                <h3 className="text-sm font-extrabold text-slate-900 break-words">{item.title}</h3>
              </div>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed line-clamp-3 break-words">{item.body}</p>
              <FactLine
                size="xs"
                className="mt-2"
                facts={[item.authorName, item.authorRole && t(`roleTitle.${item.authorRole}`), item.createdAt && formatDay(item.createdAt, lang)]}
              />
            </li>
          ))}
        </ul>
      )}
    </HomeCard>
  );
};

export default PinnedAnnouncements;
