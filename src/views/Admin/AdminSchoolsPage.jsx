import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ShieldOff, Inbox, ChevronRight, Search, SearchX } from 'lucide-react';

import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { Bone, HomeEmpty, HomeError } from '../Dashboard/components/HomeCard';
import { Segments, SlashFacts } from './adminParts';
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

  The look since 2026-10-28 (owner, mockup daftar-sekolah.html): a slash line under
  the title, the state as small segments and the order a small dropdown in one
  row, the rows one card ("Nonaktif" first in rose, then type / NPSN / city /
  subdomain, and "Yayasan: ..." or "Mandiri" under it), the dashboards' states.
*/

const CARD = 'bg-white border border-slate-100 rounded-2xl shadow-sm min-w-0';

const TYPING_PAUSE = 300;
const NO_ROWS = Object.freeze([]);

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

  let list;
  if (error) {
    list = <HomeError message={error} retryLabel={t('att.error.retry')} onRetry={() => fetchPage(0)} />;
  } else if (isFirstLoad) {
    list = (
      <div className={`${CARD} px-4 sm:px-5 py-2`} aria-busy="true" aria-label={t('common.loading')}>
        {[0, 1, 2].map((n) => (
          <div key={n} className="py-3.5">
            <Bone className="h-3.5 w-2/5" />
            <Bone className="h-3 w-3/4 mt-2" />
          </div>
        ))}
      </div>
    );
  } else if (everyCount === 0) {
    list = (
      <div className={`${CARD} p-6 max-sm:p-[18px]`}>
        <HomeEmpty icon={Inbox} title={t('adminSchools.empty')} />
      </div>
    );
  } else {
    list = (
      <>
        <div className="flex flex-wrap items-center gap-2.5 select-none">
          <div className="relative flex-1 min-w-[min(100%,20rem)]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('adminSchools.search')}
              aria-label={t('adminSchools.search')}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm font-medium placeholder-slate-500 bg-white transition-colors"
            />
          </div>
          <Segments label={t('admin.filter.state')} options={SCHOOL_STATES} value={state} onChange={setState} labelOf={(option) => t(`admin.filter.state.${option}`)} />
          <div className="w-44">
            <Select size="sm" id="adminSchoolsSort" name="sort" value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('adminSchools.sort')}>
              {SCHOOL_SORTS.map((option) => (
                <option key={option} value={option}>
                  {t('adminSchools.sortOption', { order: t(`adminSchools.sort.${option}`) })}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {total === 0 ? (
          <div className={`${CARD} p-6 max-sm:p-[18px]`}>
            <HomeEmpty
              icon={SearchX}
              title={t('admin.search.empty')}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setQuery('');
                    setState('ALL');
                  }}
                >
                  {t('admin.search.clear')}
                </Button>
              }
            />
          </div>
        ) : (
          <div className={`${CARD} px-3 sm:px-4 py-2 transition-opacity ${isRefining ? 'opacity-50' : 'opacity-100'}`} aria-busy={isRefining}>
            <p className="px-2 pt-1.5 pb-1 text-xs font-semibold text-slate-500 select-none">
              {rows.length < total ? t('adminSchools.countOf', { n: rows.length, total }) : t('adminSchools.count', { n: total })}
            </p>
            <ul>
              {rows.map((row) => (
                <li key={row.id} className="border-b border-slate-100 last:border-0">
                  <button
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className="w-full flex items-center gap-3 px-2 py-3.5 text-left rounded-xl hover:bg-slate-50 transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <span className="flex-1 min-w-0 space-y-0.5">
                      <span className="block text-sm font-bold text-slate-900 break-words">{row.name}</span>
                      <SlashFacts
                        parts={[
                          row.deactivatedAt && <span className="font-bold text-rose-700">{t('admin.list.deactivated')}</span>,
                          row.schoolType,
                          t('admin.list.npsn', { npsn: row.npsn }),
                          row.city,
                          row.subdomain,
                        ]}
                      />
                      <span className="block text-xs font-semibold text-slate-500 break-words">
                        {row.governingBody?.name ? t('adminSchools.bodyLine', { body: row.governingBody.name }) : t('adminSchools.independent')}
                      </span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            {rows.length < total && (
              <div className="px-2 pt-2 pb-2.5">
                <Button size="sm" variant="outline" onClick={() => fetchPage(rows.length)} isLoading={isAppending} className="w-full">
                  {t('admin.queue.loadMore')}
                </Button>
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="select-none">
        <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('adminSchools.title')}</h1>
        <SlashFacts
          className="block mt-2 text-sm font-medium text-slate-500"
          parts={[everyCount !== null && everyCount > 0 ? t('adminSchools.count', { n: everyCount }) : null, t('adminSchools.kinds')]}
        />
      </div>

      {selected ? (
        <AdminSchoolDetail
          school={selected}
          onBack={() => setSelectedId(null)}
          onChanged={(school) => setRows((prev) => withSchool(prev, school))}
          showToast={showToast}
        />
      ) : (
        list
      )}
    </div>
  );
};

export default AdminSchoolsPage;
