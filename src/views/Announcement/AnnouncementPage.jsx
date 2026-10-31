import React, { useState, useEffect } from 'react';
import { Pin, Search } from 'lucide-react';
import { useT } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import NotBuiltYet from '../../components/ui/NotBuiltYet';
import FactLine from '../../components/ui/FactLine';
import { api, isNotBuiltYet } from '../../services/apiClient';

/*
  `/api/announcements` does not exist — there is no Announcement model in the
  schema — so the request 404s and the page says so with NotBuiltYet instead of
  "no announcements yet", which would be a claim about the school. Every role
  that reaches this route sees the same thing.

  The look since 2026-10-31 (owner, mockup pengumuman.html items 1-5): the
  navbar's back arrow is the only one, the title is "Pengumuman" as in the menu,
  under it one grey line - the school, and a student's class - and the page sits
  in the layout's own padding and background like every other.

  The list is drawn for the day the module lands, and its fields are a guess
  until then: the same shape PinnedAnnouncements documents,
  [{ id, title, body, authorName, authorRole, createdAt, pinned }]. Align both
  with the real controller when it exists. Pinned ones come first and say so;
  the author, role and time are one grey line, no icon tile.
*/
export const AnnouncementPage = () => {
  const { t, lang } = useT();
  const { membership } = useAuth();
  const locale = lang === 'id' ? 'id-ID' : 'en-GB';
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notBuilt, setNotBuilt] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAnnouncements = async () => {
    try {
      const data = await api.get('/announcements');
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch (err) {
      if (isNotBuiltYet(err)) setNotBuilt(true);
      else console.error('Fetch Announcements Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const query = searchQuery.toLowerCase();
  const filteredAnnouncements = announcements
    .filter((ann) => (ann.title ?? '').toLowerCase().includes(query) || (ann.body ?? '').toLowerCase().includes(query))
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));

  const formatWhen = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  /* A student's class beside the school; staff have no one class, so the school alone. */
  const schoolName = membership?.school?.name ?? membership?.schoolName ?? '';
  const className = membership?.student?.class?.name ?? '';

  return (
    <div className="space-y-6">
      <div className="text-left">
        <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('ann.title')}</h1>
        <FactLine className="mt-2" facts={[schoolName, className]} />
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label={t('common.loading')}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm animate-pulse space-y-3">
              <div className="h-4 bg-slate-100 rounded w-1/3" />
              <div className="h-3 bg-slate-100 rounded w-full" />
              <div className="h-3 bg-slate-100 rounded w-5/6" />
            </div>
          ))}
        </div>
      ) : notBuilt ? (
        <NotBuiltYet />
      ) : announcements.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center shadow-sm">
          <p className="text-sm font-extrabold text-slate-900">{t('ann.empty')}</p>
          <p className="text-[13px] text-slate-500 mt-1">{t('ann.emptyNone')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* The count and the search only when there is something to count and search. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-slate-500">{t('ann.count', { n: announcements.length })}</p>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
              <input
                type="text"
                placeholder={t('ann.search')}
                aria-label={t('ann.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-[13px] text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
              />
            </div>
          </div>

          {filteredAnnouncements.length === 0 ? (
            <p className="bg-white border border-slate-100 rounded-2xl p-8 text-center text-[13px] text-slate-500 shadow-sm">
              {t('ann.emptySearch')}
            </p>
          ) : (
            filteredAnnouncements.map((ann) => (
              <article key={ann.id} className="bg-white border border-slate-100 rounded-2xl px-6 py-5 max-sm:p-[18px] shadow-sm">
                <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-extrabold text-slate-900 tracking-tight">
                  <span className="break-words min-w-0">{ann.title}</span>
                  {ann.pinned && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-brand">
                      <Pin className="w-3.5 h-3.5" aria-hidden="true" />
                      {t('dash.pinned.pinned')}
                    </span>
                  )}
                </h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-slate-700 whitespace-pre-wrap break-words">{ann.body}</p>
                <FactLine
                  size="xs"
                  className="mt-2.5"
                  facts={[ann.authorName, ann.authorRole && t(`roleTitle.${ann.authorRole}`), ann.createdAt && formatWhen(ann.createdAt)]}
                />
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AnnouncementPage;
