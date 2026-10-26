import React, { useCallback, useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';

import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import ReasonDialog from '../../components/ReasonDialog';
import { useT } from '../../i18n/LanguageContext';
import { governingBodySeatErrorMessage, isBodyDecides, isStalePrincipalDecision, principalDecisionErrorMessage } from '../../i18n/apiError';
import { governingBodyService } from '../../services/governingBodyService';
import { telLink, waLink } from '../../utils/contact';
import { othersWaiting, outcomeOf } from './principalApplications';
import PrincipalKtp from './PrincipalKtp';

/*
  The "Lamaran Kepala Sekolah" tab of a School's page (backend e206bd9, ticket 06; owner
  2026-10-26, B1-B9): any admin reads the School's applications - the waiting ones, or
  all with "Semua" - and decides them. Each card: the applicant's name and email (or
  "account deleted"), the phone to call or WhatsApp, the day asked, the KTP on "Lihat
  KTP", and Setujui (asked, saying the others waiting are closed and every KTP deleted)
  or Tolak (a reason of 3-500 the applicant reads). A decided one says who decided,
  when, and why.

  Out of date - decided elsewhere, the School headed meanwhile - is a toast and a fresh
  read; the applicant's own standing (a student, gone, joined) is said in the dialog.
  Every decision asks the page to read the School again (`onChanged`): its Principal
  and the number waiting move, and so does `version`, which reads this list again - as
  does a Principal made from "Kelola sekolah", which closes the ones waiting. A 403 means
  the seat ended (`onGone`).

  The Platform Admin reads the same while a body is switched off (ticket 06c): `source`
  swaps the four calls for theirs, `lead` the line under the heading, and a refusal
  saying the body decides (it runs) is said in place of the list.
*/

const BODY_SOURCE = {
  list: (schoolId, status) => governingBodyService.principalApplications(schoolId, status),
  ktp: (schoolId, applicationId) => governingBodyService.principalApplicationKtp(applicationId),
  approve: (schoolId, applicationId) => governingBodyService.approvePrincipalApplication(applicationId),
  reject: (schoolId, applicationId, reason) => governingBodyService.rejectPrincipalApplication(applicationId, reason),
};

const localeOf = (lang) => (lang === 'en' ? 'en-GB' : 'id-ID');

const linkClass = 'text-brand hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded';

const OUTCOME_TONE = { APPROVED: 'text-emerald-700', REJECTED: 'text-rose-700', CLOSED: 'text-slate-600', CANCELLED: 'text-slate-600' };

export const SchoolApplicationsTab = ({ school, version = 0, showToast, onChanged, onGone, source = BODY_SOURCE, lead = null }) => {
  const { t, lang } = useT();

  const [applications, setApplications] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [state, setState] = useState('loading');
  const [error, setError] = useState(null);
  const [asking, setAsking] = useState(null);
  const [busy, setBusy] = useState(false);
  const [approveError, setApproveError] = useState(null);

  const asDate = (value) => (value ? new Date(value).toLocaleDateString(localeOf(lang), { day: 'numeric', month: 'long', year: 'numeric' }) : '');

  const load = useCallback(() => {
    source
      .list(school.id, showAll ? 'ALL' : 'PENDING')
      .then((rows) => {
        setApplications(rows);
        setState('ready');
      })
      .catch((err) => {
        if (err?.status === 403) {
          onGone();
          return;
        }
        if (isBodyDecides(err)) {
          setState('bodyRuns');
          return;
        }
        setError(err);
        setState('failed');
      });
    // `version` moves when the page changed the School: the list is read again.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the trigger, not read
  }, [school.id, showAll, onGone, version, source]);

  useEffect(() => {
    load();
  }, [load]);

  /* The page reads the School again and moves `version`, which reads this list again. */
  const changed = () => onChanged();

  /* Out of date or gone: close, say so, read again. Anything else stays where it was said. */
  const outOfDate = (err) => {
    setAsking(null);
    if (err?.status === 403) {
      onGone();
      return;
    }
    showToast?.(principalDecisionErrorMessage(err, t), 'info');
    changed();
  };

  const approve = async () => {
    const row = asking.row;
    setBusy(true);
    setApproveError(null);
    try {
      await source.approve(school.id, row.id);
      setAsking(null);
      showToast?.(t('gbpa.approve.done', { name: row.applicant.fullName, school: school.name }), 'success');
      changed();
    } catch (err) {
      if (isStalePrincipalDecision(err) || err?.status === 403) outOfDate(err);
      else setApproveError(principalDecisionErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  /* ReasonDialog shows a throw inside, by `describeError`; out of date closes it instead. */
  const reject = async (reason) => {
    const row = asking.row;
    try {
      await source.reject(school.id, row.id, reason);
    } catch (err) {
      if (isStalePrincipalDecision(err) || err?.status === 403) {
        outOfDate(err);
        return;
      }
      throw err;
    }
    setAsking(null);
    showToast?.(t('gbpa.reject.done', { name: row.applicant.fullName }), 'success');
    changed();
  };

  const openApprove = (row) => {
    setApproveError(null);
    setAsking({ kind: 'approve', row });
  };

  const ktpOf = useCallback((applicationId) => source.ktp(school.id, applicationId), [source, school.id]);

  const others = asking?.kind === 'approve' ? othersWaiting(applications, asking.row.id) : 0;
  const waiting = applications.filter((row) => row.status === 'PENDING');

  const filterButton = (all, label) => (
    <button
      type="button"
      onClick={() => setShowAll(all)}
      aria-pressed={showAll === all}
      className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
        showAll === all ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  );

  return (
    <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-slate-900">{t('gbpa.section')}</h2>
          <p className="text-xs font-medium text-slate-500 mt-1 leading-relaxed">
            {lead ??
              (school.hasPrincipal && school.principal?.fullName
              ? t('gbpa.headed', { name: school.principal.fullName })
              : school.hasPrincipal
                ? t('gbpa.headedUnnamed')
                : t('gbpa.anyAdmin'))}
          </p>
        </div>
        <div className="inline-flex p-1 rounded-xl bg-slate-100 shrink-0 self-start" role="group" aria-label={t('gbpa.filter')}>
          {filterButton(false, t('gbpa.filter.waiting'))}
          {filterButton(true, t('gbpa.filter.all'))}
        </div>
      </div>

      {state === 'bodyRuns' && <p className="text-sm font-medium text-slate-500 py-2">{t('adminSchools.error.bodyDecides')}</p>}

      {state === 'loading' && <div className="h-24 rounded-2xl bg-slate-50 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />}

      {state === 'failed' && (
        <div className="space-y-3" role="alert">
          <p className="text-sm font-semibold text-rose-700">{governingBodySeatErrorMessage(error, t)}</p>
          <Button variant="outline" size="sm" onClick={load}>
            {t('gb.retry')}
          </Button>
        </div>
      )}

      {state === 'ready' &&
        (applications.length === 0 ? (
          <p className="text-sm font-medium text-slate-500 py-2">{showAll ? t('gbpa.empty.all') : t('gbpa.empty.waiting')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {applications.map((row) => {
              const outcome = outcomeOf(row);
              const name = row.applicant.fullName;
              return (
                <li key={row.id} className="py-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-bold text-slate-900 break-words">{name}</p>
                      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-slate-500">
                        {row.applicant.email ? (
                          <a href={`mailto:${row.applicant.email}`} className={`${linkClass} break-all`}>
                            {row.applicant.email}
                          </a>
                        ) : (
                          <span>{t('gbpa.accountGone')}</span>
                        )}
                        {row.applicantPhone && (
                          <span className="inline-flex items-center gap-2 flex-wrap">
                            <a href={telLink(row.applicantPhone)} className={linkClass} aria-label={t('person.call', { name })}>
                              {row.applicantPhone}
                            </a>
                            <a
                              href={waLink(row.applicantPhone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={t('person.whatsapp', { name })}
                              title={t('person.whatsapp', { name })}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-extrabold hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                            >
                              <MessageCircle className="w-3 h-3" aria-hidden="true" />
                              WhatsApp
                            </a>
                          </span>
                        )}
                        <span>{t('gba.requestedAt', { date: asDate(row.requestedAt) })}</span>
                      </p>
                      {outcome.state !== 'WAITING' && (
                        <p className={`text-xs font-semibold ${OUTCOME_TONE[outcome.state]}`}>
                          {t(`gbpa.outcome.${outcome.state}`, { by: outcome.by ?? '', date: asDate(outcome.at) })}
                        </p>
                      )}
                      {outcome.reason && <p className="text-xs font-medium text-slate-600 break-words">{t('others.reason', { reason: outcome.reason })}</p>}
                    </div>
                    {row.status === 'PENDING' && (
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <Button size="sm" onClick={() => openApprove(row)} ariaLabel={t('gbpa.approve.aria', { name })}>
                          {t('gbpa.approve')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setAsking({ kind: 'reject', row })} ariaLabel={t('gbpa.reject.aria', { name })}>
                          {t('gbpa.reject')}
                        </Button>
                      </div>
                    )}
                  </div>
                  {row.status === 'PENDING' && row.hasKtp && <PrincipalKtp key={row.id} applicationId={row.id} name={name} load={ktpOf} />}
                </li>
              );
            })}
          </ul>
        ))}

      {state === 'ready' && showAll && waiting.length > 0 && <p className="text-xs font-medium text-slate-500">{t('gbpa.waitingOfAll', { n: waiting.length })}</p>}

      <ConfirmDialog
        open={asking?.kind === 'approve'}
        title={t('gbpa.approve.title', { name: asking?.row?.applicant?.fullName ?? '' })}
        body={
          asking?.kind === 'approve' ? (
            <>
              <p>{t('gbpa.approve.body', { name: asking.row.applicant.fullName, school: school.name })}</p>
              {others > 0 && <p className="mt-1.5">{t('gbpa.approve.others', { n: others })}</p>}
              <p className="mt-1.5">{t('gbpa.approve.ktp')}</p>
              {approveError && (
                <p className="mt-2 text-rose-700 font-semibold" role="alert">
                  {approveError}
                </p>
              )}
            </>
          ) : (
            ''
          )
        }
        confirmLabel={t('gbpa.approve')}
        cancelLabel={t('common.cancel')}
        tone="brand"
        busy={busy}
        busyLabel={t('common.loading')}
        onCancel={() => setAsking(null)}
        onConfirm={approve}
      />

      {asking?.kind === 'reject' && (
        <ReasonDialog
          key={`reject:${asking.row.id}`}
          title={t('gbpa.reject.title', { name: asking.row.applicant.fullName })}
          body={t('gbpa.reject.body')}
          label={t('gba.reason')}
          hint={t('gbpa.reject.hint')}
          confirmLabel={t('gbpa.reject')}
          onClose={() => setAsking(null)}
          onSubmit={reject}
          describeError={(err) => principalDecisionErrorMessage(err, t)}
        />
      )}
    </section>
  );
};

export default SchoolApplicationsTab;
