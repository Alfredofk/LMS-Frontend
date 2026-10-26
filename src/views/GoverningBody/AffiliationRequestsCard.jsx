import React, { useCallback, useEffect, useState } from 'react';

import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import ReasonDialog from '../../components/ReasonDialog';
import { useT } from '../../i18n/LanguageContext';
import { affiliationDecisionErrorMessage, isStaleAffiliation } from '../../i18n/apiError';
import { governingBodyService } from '../../services/governingBodyService';

/*
  Independent Schools asking to join the body (backend 261a9c7, ticket 08; owner
  2026-10-26, E7), above the list on the Schools tab: shown while one waits, or while
  its history is open. With none waiting it is one grey line, "Riwayat permintaan
  bergabung", that opens the history (owner 2026-10-26, R1-R3) - also for a body with no
  School yet, which an independent School may still ask to join. Each: the School, "NPSN / type / city", the Principal who
  asked and the day. Setujui (asked: the School joins; its Principal is the body's to
  make from then) or Tolak (a reason of 3-500 the Principal reads). "Lihat riwayat
  permintaan" lists the decided ones with who and why.

  Out of date (decided elsewhere, the School joined another body or was switched off) is
  a toast and a fresh read; an approval also reads the Schools again (`onJoined`). A 403
  is the seat gone (`onGone`).
*/

const localeOf = (lang) => (lang === 'en' ? 'en-GB' : 'id-ID');

const OUTCOME = { APPROVED: 'text-emerald-700', REJECTED: 'text-rose-700', CANCELLED: 'text-slate-600' };

export const AffiliationRequestsCard = ({ showToast, onJoined, onGone }) => {
  const { t, lang } = useT();
  const [requests, setRequests] = useState([]);
  const [history, setHistory] = useState(false);
  const [asking, setAsking] = useState(null);
  const [busy, setBusy] = useState(false);
  const [approveError, setApproveError] = useState(null);

  const asDate = (value) => (value ? new Date(value).toLocaleDateString(localeOf(lang), { day: 'numeric', month: 'long', year: 'numeric' }) : '');

  const load = useCallback(() => {
    governingBodyService
      .affiliationRequests(history ? 'ALL' : 'PENDING')
      .then(setRequests)
      .catch((err) => {
        if (err?.status === 403) onGone();
      });
  }, [history, onGone]);

  useEffect(() => {
    load();
  }, [load]);

  const outOfDate = (err) => {
    setAsking(null);
    if (err?.status === 403) {
      onGone();
      return;
    }
    showToast?.(affiliationDecisionErrorMessage(err, t), 'info');
    load();
  };

  const approve = async () => {
    const row = asking.row;
    setBusy(true);
    setApproveError(null);
    try {
      await governingBodyService.approveAffiliation(row.id);
      setAsking(null);
      showToast?.(t('gbaf.approve.done', { school: row.school.name }), 'success');
      load();
      onJoined();
    } catch (err) {
      if (isStaleAffiliation(err) || err?.status === 403) outOfDate(err);
      else setApproveError(affiliationDecisionErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const reject = async (reason) => {
    const row = asking.row;
    try {
      await governingBodyService.rejectAffiliation(row.id, reason);
    } catch (err) {
      if (isStaleAffiliation(err) || err?.status === 403) {
        outOfDate(err);
        return;
      }
      throw err;
    }
    setAsking(null);
    showToast?.(t('gbaf.reject.done', { school: row.school.name }), 'success');
    load();
  };

  const waiting = requests.filter((row) => row.status === 'PENDING');
  if (!history && waiting.length === 0) {
    return (
      <p className="text-xs font-medium text-slate-500">
        <button
          type="button"
          onClick={() => setHistory(true)}
          className="font-extrabold text-brand hover:text-brand-deep underline underline-offset-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
        >
          {t('gbaf.history.line')}
        </button>
      </p>
    );
  }

  return (
    <section className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-slate-900">{t('gbaf.title')}</h2>
          <p className="text-xs font-medium text-slate-500 mt-1 leading-relaxed">{t('gbaf.body')}</p>
        </div>
        <button
          type="button"
          onClick={() => setHistory((was) => !was)}
          className="text-xs font-extrabold text-brand hover:text-brand-deep underline underline-offset-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
        >
          {history ? t('gbaf.history.hide') : t('gbaf.history.show')}
        </button>
      </div>

      {requests.length === 0 ? (
        <p className="text-sm font-medium text-slate-500">{t('gbaf.history.empty')}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {requests.map((row) => (
            <li key={row.id} className="py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-bold text-slate-900 break-words">{row.school.name}</p>
                <p className="text-xs font-medium text-slate-500 break-words">
                  {t('gbpa.npsn', { npsn: row.school.npsn })}
                  <span className="text-slate-300"> / </span>
                  {row.school.schoolType}
                  {row.school.city && (
                    <>
                      <span className="text-slate-300"> / </span>
                      {row.school.city}
                    </>
                  )}
                </p>
                <p className="text-xs font-medium text-slate-500">{t('gbaf.requestedBy', { name: row.requestedBy.fullName, date: asDate(row.requestedAt) })}</p>
                {row.status !== 'PENDING' && (
                  <p className={`text-xs font-semibold ${OUTCOME[row.status] ?? 'text-slate-600'}`}>
                    {t(`gbaf.outcome.${row.status}`, { by: row.decidedBy?.fullName ?? '', date: asDate(row.decidedAt) })}
                  </p>
                )}
                {row.status === 'REJECTED' && row.rejectionReason && <p className="text-xs font-medium text-slate-600 break-words">{t('others.reason', { reason: row.rejectionReason })}</p>}
              </div>
              {row.status === 'PENDING' && (
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => {
                      setApproveError(null);
                      setAsking({ kind: 'approve', row });
                    }}
                    ariaLabel={t('gbaf.approve.aria', { school: row.school.name })}
                  >
                    {t('gbpa.approve')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAsking({ kind: 'reject', row })} ariaLabel={t('gbaf.reject.aria', { school: row.school.name })}>
                    {t('gbpa.reject')}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={asking?.kind === 'approve'}
        title={t('gbaf.approve.title', { school: asking?.row?.school?.name ?? '' })}
        body={
          asking?.kind === 'approve' ? (
            <>
              <p>{t('gbaf.approve.body')}</p>
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
          title={t('gbaf.reject.title', { school: asking.row.school.name })}
          body={t('gbaf.reject.body')}
          label={t('gba.reason')}
          hint={t('gbpw.reason.hint')}
          confirmLabel={t('gbpa.reject')}
          onClose={() => setAsking(null)}
          onSubmit={reject}
          describeError={(err) => affiliationDecisionErrorMessage(err, t)}
        />
      )}
    </section>
  );
};

export default AffiliationRequestsCard;
