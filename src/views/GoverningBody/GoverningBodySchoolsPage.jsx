import React, { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { bodySchoolsErrorMessage, governingBodySeatErrorMessage, isHadPrincipal } from '../../i18n/apiError';
import { governingBodyService } from '../../services/governingBodyService';
import { GOVERNING_BODY_SCHOOLS } from '../../constants/roles';
import { schoolAddressOf } from '../../constants/subdomain';
import { copyText } from '../../utils/copyText';
import { matchesSchool } from './bodySchools';
import GoverningBodySchoolFixForm from './GoverningBodySchoolFixForm';
import useMoveOn from './useMoveOn';

/*
  /governing-body/schools, the body's Schools tab (backend ed0d304, governing-body
  ticket 05; owner 2026-10-25: a tab of its own between the body and its admins).
  One read, `GET /governing-body/schools`, by name: each School's NPSN, type, city,
  its School Code to copy, and whether a Principal sits there now.

  - A table from md, a card per School below it; a search box over the name, NPSN and
    city, in the browser (the read has no paging).
  - "Buat sekolah" opens /governing-body/schools/new.
  - "Ubah" opens `GoverningBodySchoolFixForm` under the row, for a School with no
    Principal now. The list cannot tell one that had a Principal who left
    (`hasPrincipal` is now, the rule is ever: backend 9697362), so that is learnt from
    the 409, said, and the button goes for this visit.
  - A 403 means the seat ended or the body was switched off: the other tabs' "gone".
*/

const CopyCode = ({ code }) => {
  const { t } = useT();
  const [copied, setCopied] = useState(null);
  const copy = async () => {
    setCopied((await copyText(code)) ? 'ok' : 'failed');
    setTimeout(() => setCopied(null), 2500);
  };
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-sm font-bold tracking-wider text-slate-900">{code}</span>
      <button
        type="button"
        onClick={copy}
        aria-live="polite"
        aria-label={copied ? undefined : t('gbs.copyCode', { code })}
        className="px-2 py-0.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {copied === 'ok' ? t('gb.copied') : copied === 'failed' ? t('gb.copyFailed') : t('gb.copy')}
      </button>
    </span>
  );
};

/* A cell's own label, on a phone only: the table's header row says it from md. */
const CellLabel = ({ children }) => <span className="md:hidden text-[11px] font-semibold text-slate-500 block">{children}</span>;

const COLUMNS = 'md:grid md:grid-cols-[minmax(0,1fr)_6.5rem_10.5rem_7.5rem_4.5rem] md:gap-4 md:items-center';

export const GoverningBodySchoolsPage = () => {
  const { governingBody: cached } = useAuth();
  const { t } = useT();
  const { showToast } = useOutletContext() ?? {};
  const moveOn = useMoveOn();

  const [schools, setSchools] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [needle, setNeedle] = useState('');
  const [fixing, setFixing] = useState(null);
  /* Schools a fix was refused for, having had a Principal: their "Ubah" goes. */
  const [locked, setLocked] = useState(() => new Set());

  const load = useCallback(() => {
    governingBodyService
      .schools()
      .then((answer) => {
        setSchools(answer);
        setState('ready');
      })
      .catch((err) => {
        setError(err);
        setState(err?.status === 403 ? 'gone' : 'failed');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const checkAgain = async () => {
    setChecking(true);
    try {
      if (!(await moveOn())) load();
    } catch {
      load();
    } finally {
      setChecking(false);
    }
  };

  const saved = (school) => {
    setFixing(null);
    if (!school) return;
    setSchools((prev) => prev.map((row) => (row.id === school.id ? school : row)).sort((a, b) => a.name.localeCompare(b.name)));
    showToast?.(t('gbs.fix.done', { name: school.name }), 'success');
  };

  const refused = (school) => (err) => {
    setFixing(null);
    if (err?.status === 403) {
      setState('gone');
      return;
    }
    if (isHadPrincipal(err)) {
      setLocked((prev) => new Set(prev).add(school.id));
      showToast?.(t('gbs.error.hadPrincipal'), 'error');
      return;
    }
    showToast?.(bodySchoolsErrorMessage(err, t), 'info');
    load();
  };

  const name = cached?.name ?? '';
  const shown = schools.filter((school) => matchesSchool(school, needle));
  const createLink = (
    <Link
      to={`${GOVERNING_BODY_SCHOOLS}/new`}
      className="inline-flex items-center px-4 py-2 text-sm rounded-xl font-bold bg-brand hover:bg-brand-deep text-white shadow-md shadow-brand/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
    >
      {t('gbs.create')}
    </Link>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('gbs.title')}</h1>
          {name && (
            <p className="text-sm font-semibold text-slate-500 mt-1 break-words">
              {name}
              <span className="text-slate-300"> / </span>
              {t('place.governingBodyAdmin')}
            </p>
          )}
        </div>
        {state === 'ready' && schools.length > 0 && createLink}
      </div>

      {state === 'loading' && <div className="h-48 rounded-2xl bg-white border border-slate-100 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />}

      {state === 'gone' && (
        <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3" role="alert">
          <p className="text-sm font-bold text-slate-900">{t('gb.gone.title')}</p>
          <p className="text-xs font-medium text-slate-500 leading-relaxed">{t('gb.gone.body')}</p>
          <Button variant="outline" size="sm" onClick={checkAgain} isLoading={checking}>
            {t('gb.checkAgain')}
          </Button>
        </section>
      )}

      {state === 'failed' && (
        <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3" role="alert">
          <p className="text-sm font-semibold text-rose-700">{governingBodySeatErrorMessage(error, t)}</p>
          <Button variant="outline" size="sm" onClick={load}>
            {t('gb.retry')}
          </Button>
        </section>
      )}

      {state === 'ready' && schools.length === 0 && (
        <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-3">
          <h2 className="text-base font-extrabold text-slate-900">{t('gbs.empty.title')}</h2>
          <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-prose">{t('gbs.empty.body')}</p>
          <div className="pt-1">{createLink}</div>
        </section>
      )}

      {state === 'ready' && schools.length > 0 && (
        <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div className="w-full sm:max-w-xs">
              <Input
                id="gbsSearch"
                name="search"
                type="search"
                label={t('gbs.search.label')}
                placeholder={t('gbs.search.placeholder')}
                autoComplete="off"
                value={needle}
                onChange={(e) => setNeedle(e.target.value)}
              />
            </div>
            <p className="text-xs font-semibold text-slate-500" aria-live="polite">
              {needle.trim() ? t('gbs.count.filtered', { shown: shown.length, n: schools.length }) : t('gbs.count', { n: schools.length })}
            </p>
          </div>

          {shown.length === 0 ? (
            <p className="text-sm font-medium text-slate-500 py-4">{t('gbs.noMatch')}</p>
          ) : (
            <div>
              <div className={`hidden ${COLUMNS} pb-2 border-b border-slate-100 text-[11px] font-semibold text-slate-500`} aria-hidden="true">
                <span>{t('gbs.col.name')}</span>
                <span>{t('reg.field.npsn')}</span>
                <span>{t('gbs.col.code')}</span>
                <span>{t('gbs.col.principal')}</span>
                <span />
              </div>
              <ul className="divide-y divide-slate-100">
                {shown.map((school) => {
                  const address = schoolAddressOf(school.subdomain ?? null);
                  const canFix = !school.hasPrincipal && !locked.has(school.id);
                  return (
                    <li key={school.id} className="py-3.5 space-y-3">
                      <div className={`grid grid-cols-2 gap-x-4 gap-y-2.5 ${COLUMNS}`}>
                        <div className="col-span-2 md:col-span-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 break-words">{school.name}</p>
                          <p className="text-xs font-medium text-slate-500 mt-0.5 break-words">
                            {school.schoolType}
                            <span className="text-slate-300"> / </span>
                            {school.city}
                            {school.schoolType === 'SMK' && school.durationYears && (
                              <>
                                <span className="text-slate-300"> / </span>
                                {t('reg.field.duration.years', { n: school.durationYears })}
                              </>
                            )}
                            {address && (
                              <>
                                <span className="text-slate-300"> / </span>
                                <span className="break-all">{address}</span>
                              </>
                            )}
                          </p>
                          {school.deactivatedAt && <p className="text-xs font-semibold text-rose-700 mt-0.5">{t('gbs.deactivated')}</p>}
                        </div>
                        <div className="min-w-0">
                          <CellLabel>{t('reg.field.npsn')}</CellLabel>
                          <span className="text-sm font-semibold text-slate-700 tabular-nums">{school.npsn}</span>
                        </div>
                        <div className="min-w-0">
                          <CellLabel>{t('gbs.col.code')}</CellLabel>
                          <CopyCode code={school.schoolCode} />
                        </div>
                        <div className="min-w-0">
                          <CellLabel>{t('gbs.col.principal')}</CellLabel>
                          <span className={`text-sm font-semibold ${school.hasPrincipal ? 'text-emerald-700' : 'text-slate-500'}`}>
                            {school.hasPrincipal ? t('gbs.principal.yes') : t('gbs.principal.no')}
                          </span>
                        </div>
                        <div className="flex items-end md:justify-end">
                          {canFix && fixing !== school.id && (
                            <Button size="sm" variant="outline" onClick={() => setFixing(school.id)} ariaLabel={t('gbs.fix.aria', { name: school.name })}>
                              {t('gbs.fix')}
                            </Button>
                          )}
                        </div>
                      </div>
                      {fixing === school.id && (
                        <GoverningBodySchoolFixForm key={school.id} school={school} onCancel={() => setFixing(null)} onSaved={saved} onRefused={refused(school)} />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <p className="text-xs font-medium text-slate-500 leading-relaxed border-t border-slate-100 pt-3">{t('gbs.code.hint')}</p>
        </section>
      )}
    </div>
  );
};

export default GoverningBodySchoolsPage;
