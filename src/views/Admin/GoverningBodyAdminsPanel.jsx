import React, { useCallback, useEffect, useState } from 'react';

import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import ReasonDialog from '../../components/ReasonDialog';
import { adminGoverningBodyService } from '../../services/adminGoverningBodyService';
import { governingBodySeatErrorMessage, isStaleSeat } from '../../i18n/apiError';
import { useT } from '../../i18n/LanguageContext';
import { decidesApplications, removalNoteOf } from './bodyDecisions';

/*
  A body's admins, for the Platform Admin (backend 8aff4f4; owner 2026-10-24: on the
  approved registration's review, under the correction and the address). One read,
  `GET /admin/governing-bodies/:id/admins`: the code, the sitting admins (the senior
  first) and the applications waiting.

  - The brake: any sitting admin is removed with a reason of 3-500 they read - the
    senior, whose place the next takes, or the last, which leaves the body with none.
    The question says which.
  - A body with no admin: the Platform Admin approves (asked first; the one approved
    becomes its senior) or rejects with a reason, in the senior's place. Nobody is
    made an admin by email: whoever should be applies with the code, shown here to
    hand on. Once someone sits, their senior decides (409), and this reads again.
*/
export const GoverningBodyAdminsPanel = ({ bodyId, showToast }) => {
  const { t, lang } = useT();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  /* { kind: 'approve' | 'reject' | 'remove', row } */
  const [asking, setAsking] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    return adminGoverningBodyService
      .admins(bodyId)
      .then(setData)
      .catch((err) => setError(governingBodySeatErrorMessage(err, t)));
  }, [bodyId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const locale = lang === 'en' ? 'en-GB' : 'id-ID';
  const asDate = (value) => (value ? new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : null);

  const refused = (err) => {
    setAsking(null);
    showToast?.(governingBodySeatErrorMessage(err, t), isStaleSeat(err) ? 'info' : 'error');
    load();
  };

  const approve = async () => {
    const row = asking.row;
    setBusy(true);
    try {
      await adminGoverningBodyService.approveApplication(bodyId, row.id);
      setAsking(null);
      showToast?.(t('gbr.admins.approve.done', { name: row.user.fullName }), 'success');
      load();
    } catch (err) {
      refused(err);
    } finally {
      setBusy(false);
    }
  };

  /* ReasonDialog shows a throw inside; out of date closes it and reads again. */
  const withReason = (call, doneKey) => async (reason) => {
    const row = asking.row;
    try {
      await call(bodyId, row.id, reason);
    } catch (err) {
      if (isStaleSeat(err)) {
        refused(err);
        return;
      }
      throw err;
    }
    setAsking(null);
    showToast?.(t(doneKey, { name: row.user.fullName }), 'success');
    load();
  };

  const admins = data?.admins ?? [];
  const applications = data?.applications ?? [];
  const decides = data ? decidesApplications(admins) : false;
  const senior = admins[0] ?? null;
  const note = asking?.kind === 'remove' ? removalNoteOf(admins, asking.row.id) : null;

  const person = (row, facts) => (
    <div className="min-w-0">
      <p className="text-sm font-bold text-slate-900 break-words">{row.user.fullName}</p>
      <p className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs font-medium text-slate-500 mt-0.5">
        <span className="break-all">{row.user.email}</span>
        {facts.filter(Boolean).map((fact) => (
          <span key={fact}>{fact}</span>
        ))}
      </p>
    </div>
  );

  return (
    <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm space-y-4">
      <div>
        <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">{t('gbr.admins.section')}</h3>
        <p className="text-xs font-semibold text-slate-500 mt-1 leading-relaxed">{t('gbr.admins.lead')}</p>
      </div>

      {!data && !error && <div className="h-24 rounded-xl bg-slate-50 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />}

      {error && (
        <div className="space-y-2" role="alert">
          <p className="text-sm font-semibold text-rose-700">{error}</p>
          <Button variant="outline" size="sm" onClick={load}>
            {t('gb.retry')}
          </Button>
        </div>
      )}

      {data && (
        <>
          <div>
            <h4 className="text-xs font-extrabold text-slate-700">
              {t('gba.admins')} <span className="text-slate-500">({admins.length})</span>
            </h4>
            {admins.length === 0 ? (
              <p className="text-xs font-semibold text-amber-700 leading-relaxed mt-1">{t('gbr.admins.none', { code: data.governingBody?.code ?? '' })}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {admins.map((row) => (
                  <li key={row.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                    {person(row, [row.senior && t('gba.senior'), row.approvedAt && t('gba.approvedAt', { date: asDate(row.approvedAt) })])}
                    <Button size="sm" variant="outline" className="shrink-0 self-start sm:self-auto" onClick={() => setAsking({ kind: 'remove', row })}>
                      {t('gba.remove')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100">
            <h4 className="text-xs font-extrabold text-slate-700">
              {t('gba.waiting')} <span className="text-slate-500">({applications.length})</span>
            </h4>
            {!decides && senior && applications.length > 0 && (
              <p className="text-xs font-medium text-slate-500 leading-relaxed mt-1">{t('gbr.admins.seniorDecides', { name: senior.user.fullName, email: senior.user.email })}</p>
            )}
            {applications.length === 0 ? (
              <p className="text-xs font-medium text-slate-500 mt-1">{t('gba.waiting.empty')}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {applications.map((row) => (
                  <li key={row.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                    {person(row, [t('gba.requestedAt', { date: asDate(row.requestedAt) })])}
                    {decides && (
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" onClick={() => setAsking({ kind: 'approve', row })}>
                          {t('gba.approve')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setAsking({ kind: 'reject', row })}>
                          {t('gba.reject')}
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={asking?.kind === 'approve'}
        title={t('gba.approve.title', { name: asking?.row?.user?.fullName ?? '' })}
        body={t('gbr.admins.approve.body')}
        confirmLabel={t('gba.approve')}
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
          title={t('gba.reject.title', { name: asking.row.user.fullName })}
          body={t('gba.reject.body')}
          label={t('gba.reason')}
          hint={t('gba.reject.hint')}
          confirmLabel={t('gba.reject')}
          onClose={() => setAsking(null)}
          onSubmit={withReason(adminGoverningBodyService.rejectApplication, 'gba.reject.done')}
          describeError={(err) => governingBodySeatErrorMessage(err, t)}
        />
      )}

      {asking?.kind === 'remove' && (
        <ReasonDialog
          key={`remove:${asking.row.id}`}
          title={t('gba.remove.title', { name: asking.row.user.fullName })}
          body={
            note?.state === 'LAST'
              ? t('gbr.admins.remove.last')
              : note?.state === 'SENIOR'
                ? t('gbr.admins.remove.senior', { name: note.next.user.fullName, email: note.next.user.email })
                : t('gba.remove.body')
          }
          label={t('gba.reason')}
          hint={t('gba.remove.hint')}
          confirmLabel={t('gba.remove')}
          onClose={() => setAsking(null)}
          onSubmit={withReason(adminGoverningBodyService.removeAdmin, 'gba.remove.done')}
          describeError={(err) => governingBodySeatErrorMessage(err, t)}
        />
      )}
    </section>
  );
};

export default GoverningBodyAdminsPanel;
