import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ShieldOff, Inbox, ChevronRight, Search, SearchX } from 'lucide-react';

import Select from '../../components/ui/Select';
import AdminSchoolDetail from './AdminSchoolDetail';
import { adminService } from '../../services/adminService';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import { SCHOOL_SORTS, SCHOOL_STATES, schoolsQueryOf, withPage, withSchool } from './adminSchools';

/*
  /admin/schools, every School on the platform for its admin (backend ed0d304,
  `GET /admin/schools`; owner 2026-10-25: a tab of its own, the queue's shape). The
  queue reads registrations, and a Governing Body's School has none, so before this
  such a School was nowhere on the admin's screens.

  - Filtered in the database, as the queue is: one search box (name, NPSN, city,
    subdomain), live or switched off, and the order (name, newest, oldest). Fifty a
    page and "Muat lagi"; `total` is the filtered count.
  - A row: the name, one grey line (NPSN / type / city / subdomain), and the
    Governing Body or "Mandiri" beside it, as text. The School Code is not shown
    (owner): the admin hands none out.
  - A row opens `AdminSchoolDetail` in place of the list, as a registration's
    review does: its facts, its address, switching it off and on and its Principal
    by the School's own id (tickets 06b-08), its history under bodies, a body School's
    Principal applications, and for an independent School its registration's review.
  - A 403 is this account not being a Platform Admin, said as the queue says it.
*/

const TYPING_PAUSE = 300;
const NO_ROWS = Object.freeze([]);

const chipClass = (on) =>
  `px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
    on ? 'bg-brand text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300'
  }`;

export const AdminSchoolsPage = () => {
  const { showToast } = useOutletContext() ?? {};
  const { t } = useT();

  const [query, setQuery] = useState('');
  const [needle, setNeedle] = useState('');
  const [state, setState] = useState('ALL');
  const [sort, setSort] = useState('name');

  const [rows, setRows] = useState(NO_ROWS);
  const [total, setTotal] = useState(0);
  const [everyCount, setEveryCount] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const [isFetching, setIsFetching] = useState(true);
  const [isAppending, setIsAppending] = useState(false);
  const [error, setError] = useState(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setNeedle(query.trim()), TYPING_PAUSE);
    return () => clearTimeout(id);
  }, [query]);

  /* A late answer to an older filter is dropped, as in the queue. */
  const seq = useRef(0);

  const fetchPage = useCallback(
    async (offset) => {
      const mine = ++seq.current;
      const append = offset > 0;
      if (append) setIsAppending(true);
      else setIsFetching(true);
      setError(null);
      setDenied(false);

      try {
        const answer = await adminService.schools(schoolsQueryOf({ needle, state, sort, offset }));
        if (mine !== seq.current) return;
        const page = answer?.schools ?? [];
        setRows((prev) => (append ? withPage(prev, page) : page.length ? page : NO_ROWS));
        setTotal(answer?.total ?? page.length);
        /* Unfiltered, the number tells an empty platform from an empty search. */
        if (!needle && state === 'ALL') setEveryCount(answer?.total ?? page.length);
      } catch (err) {
        if (mine !== seq.current) return;
        if (err?.status === 403) setDenied(true);
        else setError(apiErrorMessage(err, t));
      } finally {
        if (mine === seq.current) {
          if (append) setIsAppending(false);
          else setIsFetching(false);
        }
      }
    },
    [needle, state, sort, t]
  );

  useEffect(() => {
    fetchPage(0);
  }, [fetchPage]);

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  if (denied) {
    return (
      <div className="py-16 px-6 text-center border border-dashed border-slate-200 rounded-2xl bg-white">
        <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto">
          <ShieldOff className="w-5 h-5 text-slate-400" aria-hidden="true" />
        </div>
        <h2 className="mt-3.5 text-sm font-extrabold text-slate-700">{t('admin.notAdmin.title')}</h2>
        <p className="mt-1.5 text-xs font-semibold text-slate-500 leading-relaxed max-w-sm mx-auto">{t('admin.notAdmin.body')}</p>
      </div>
    );
  }

  const isFirstLoad = isFetching && rows.length === 0;
  const isRefining = isFetching && rows.length > 0;

  return (
    <div className="space-y-6">
      <div className="select-none">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('adminSchools.title')}</h1>
        <p className="text-xs sm:text-sm text-slate-500 font-bold mt-1">{t('adminSchools.subtitle')}</p>
      </div>

      {selected ? (
        <AdminSchoolDetail
          school={selected}
          onBack={() => setSelectedId(null)}
          onChanged={(school) => setRows((prev) => withSchool(prev, school))}
          showToast={showToast}
        />
      ) : error ? (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : isFirstLoad ? (
        <div className="h-40 bg-white border border-slate-100 rounded-2xl animate-pulse" aria-busy="true" aria-label={t('common.loading')} />
      ) : everyCount === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-white select-none">
          <Inbox className="w-9 h-9 text-slate-300 mx-auto" aria-hidden="true" />
          <p className="mt-2.5 text-xs font-extrabold text-slate-500">{t('adminSchools.empty')}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between select-none">
            <div className="relative w-full lg:max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('adminSchools.search')}
                aria-label={t('adminSchools.search')}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand focus:ring-1 focus:ring-brand outline-none text-xs font-semibold placeholder-slate-500 bg-white shadow-sm transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5" role="group" aria-label={t('admin.filter.state')}>
                {SCHOOL_STATES.map((option) => (
                  <button key={option} type="button" onClick={() => setState(option)} aria-pressed={state === option} className={chipClass(state === option)}>
                    {t(`admin.filter.state.${option}`)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="adminSchoolsSort" className="text-[11px] font-bold text-slate-500">
                  {t('adminSchools.sort')}
                </label>
                <div className="w-36">
                  <Select id="adminSchoolsSort" name="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
                    {SCHOOL_SORTS.map((option) => (
                      <option key={option} value={option}>
                        {t(`adminSchools.sort.${option}`)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {total === 0 ? (
            <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-white select-none">
              <SearchX className="w-9 h-9 text-slate-300 mx-auto" aria-hidden="true" />
              <p className="mt-2.5 text-xs font-extrabold text-slate-500">{t('admin.search.empty')}</p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setState('ALL');
                }}
                className="mt-3 text-xs font-bold text-brand hover:text-brand-deep underline underline-offset-4 cursor-pointer focus:outline-none"
              >
                {t('admin.search.clear')}
              </button>
            </div>
          ) : (
            <div className={`space-y-2.5 transition-opacity ${isRefining ? 'opacity-50' : 'opacity-100'}`} aria-busy={isRefining}>
              <p className="text-xs font-semibold text-slate-500 select-none">
                {rows.length < total ? t('adminSchools.countOf', { n: rows.length, total }) : t('adminSchools.count', { n: total })}
              </p>

              {rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className="w-full bg-white border border-slate-100 hover:border-brand/40 hover:shadow-md rounded-2xl p-4 shadow-sm grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_12rem_auto] items-center gap-x-4 gap-y-1 text-left transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-slate-900 break-words">
                      {row.name}
                      {row.deactivatedAt && <span className="ml-2 text-xs font-bold text-rose-700">{t('admin.list.deactivated')}</span>}
                    </p>
                    <p className="text-xs font-medium text-slate-500 mt-0.5 break-words">
                      NPSN {row.npsn}
                      <span className="text-slate-300"> / </span>
                      {row.schoolType}
                      <span className="text-slate-300"> / </span>
                      {row.city}
                      {row.subdomain && (
                        <>
                          <span className="text-slate-300"> / </span>
                          <span className="break-all">{row.subdomain}</span>
                        </>
                      )}
                    </p>
                    <p className="sm:hidden text-xs font-semibold text-slate-600 mt-0.5 break-words">{row.governingBody?.name ?? t('adminSchools.independent')}</p>
                  </div>
                  <p className="hidden sm:block text-xs font-semibold text-slate-600 break-words">{row.governingBody?.name ?? t('adminSchools.independent')}</p>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" aria-hidden="true" />
                </button>
              ))}

              {rows.length < total && (
                <button
                  type="button"
                  onClick={() => fetchPage(rows.length)}
                  disabled={isAppending}
                  className="w-full py-3 rounded-2xl border border-dashed border-slate-200 bg-white text-xs font-extrabold text-brand hover:border-brand/40 hover:bg-brand-tint/40 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-default"
                >
                  {isAppending ? t('common.loading') : t('admin.queue.loadMore')}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminSchoolsPage;
