import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Megaphone, Calendar, User, ChevronLeft, Search } from 'lucide-react';
import { useT } from '../../i18n/LanguageContext';
import NotBuiltYet from '../../components/ui/NotBuiltYet';
import { api, isNotBuiltYet } from '../../services/apiClient';

/*
  `/api/announcements` does not exist — there is no Announcement model in the
  schema — so the request 404s and the page says so with NotBuiltYet instead of
  "no announcements yet", which would be a claim about the school. Every role
  that reaches this route sees the same thing.
*/
export const AnnouncementPage = () => {
  const { t, lang } = useT();
  const locale = lang === 'id' ? 'id-ID' : 'en-GB';
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notBuilt, setNotBuilt] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

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

  const filteredAnnouncements = announcements.filter(ann => 
    ann.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ann.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 sm:p-8 font-sans">
      
      {/* Header Back Button & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2.5 bg-white border border-slate-100 hover:border-slate-200 text-slate-700 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
            aria-label={t('ann.back')}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 leading-tight">
              {t('ann.title')}
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              {t('ann.subtitle')}
            </p>
          </div>
        </div>

        {/* Search Bar — nothing to search while the feature is not built */}
        {!notBuilt && (
        <div className="relative w-full sm:w-72 select-none">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t('ann.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs font-semibold text-slate-800 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all shadow-sm"
          />
        </div>
        )}
      </div>

      {/* Main Content List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm animate-pulse space-y-3">
              <div className="h-4 bg-slate-100 rounded w-1/3" />
              <div className="h-3 bg-slate-100 rounded w-full" />
              <div className="h-3 bg-slate-100 rounded w-5/6" />
              <div className="flex gap-4 pt-2">
                <div className="h-3 bg-slate-100 rounded w-16" />
                <div className="h-3 bg-slate-100 rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : notBuilt ? (
        <NotBuiltYet />
      ) : filteredAnnouncements.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center shadow-sm select-none">
          <div className="w-16 h-16 bg-brand-tint text-brand rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Megaphone className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-800">{t('ann.empty')}</h3>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            {searchQuery ? t('ann.emptySearch') : t('ann.emptyNone')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAnnouncements.map((ann) => (
            <div 
              key={ann.id}
              className="bg-white border border-slate-100 hover:border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row gap-5 relative group"
            >
              {/* Icon badge left column */}
              <div className="w-12 h-12 bg-pink-50 text-pink-500 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                <Megaphone className="w-6 h-6" />
              </div>

              {/* Main content body */}
              <div className="flex-1 space-y-2.5">
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug group-hover:text-brand transition-colors">
                  {ann.title}
                </h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed whitespace-pre-wrap">
                  {ann.content}
                </p>

                {/* Footer metadata details */}
                <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 pt-3 border-t border-slate-50 text-[10px] text-slate-500 font-bold select-none">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {t('ann.by')}{' '}
                      <span className="text-slate-500">
                        {ann.author_name || t('ann.authorFallback')}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formatDate(ann.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnnouncementPage;
