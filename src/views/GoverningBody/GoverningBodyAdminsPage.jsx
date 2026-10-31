import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import ReasonDialog from '../../components/ReasonDialog';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { governingBodySeatErrorMessage, isStaleSeat } from '../../i18n/apiError';
import { governingBodyService } from '../../services/governingBodyService';
import { leaveStateOf, seniorOf } from './governingBody';
import useMoveOn from './useMoveOn';
import { ADMIN_CARD, CARD_TITLE, SlashFacts } from '../Admin/adminParts';
import { HomeError } from '../Dashboard/components/HomeCard';
import { Initials, RowsLoading, SeatGone } from './bodyParts';

/*
  /governing-body/admins, the body's second tab (backend 3d7d05a, governing-body
  ticket 04; owner 2026-10-24: its own tab, not a part of the first page). One read,
  `GET /governing-body/admins`: the sitting admins, the senior first, and the
  applications waiting, oldest first - each by name and email, for every admin.

  - Only the senior admin decides (`youAreSenior`): approve (asked first), reject
    with a reason of 3-500 the applicant reads, and remove another admin with a
    reason they read. Every other admin reads the same lists with no buttons, and a
    line saying who decides. The server re-checks under the body's lock (403).
  - Any admin leaves, unless the last (`leaveStateOf`); when the senior leaves, the
    next by approval is senior, which the question names. Afterwards the token is
    traded in - only a refresh drops a seat that ended - and the person goes where
    their places say.
  - A decision made meanwhile elsewhere (`isStaleSeat`) is a toast and a fresh read.
  - A 403 that is not "only the senior" means the seat ended or the body was
    switched off: the same "gone" state as the first page.

  The look since 2026-10-29 (owner, mockup yayasan-sekolah-admin.html): a slash line
  of the admins and applications waiting, the dashboards' frame, round initials and one
  grey slash line per person ("Admin senior" first in brand, as on the platform admin's
  panel), Tolak, Keluarkan and Keluar dari yayasan `dangerOutline`.
*/

const localeOf = (lang) => (lang === 'en' ? 'en-GB' : 'id-ID');

/* One person: round initials, the name, then one grey slash line ("Admin senior" first in brand). */
const PersonRow = ({ person, lead = null, facts, children }) => (
  <li className="py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
    <div className="min-w-0 flex items-center gap-3">
      <Initials name={person.fullName} />
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900 break-words">{person.displayName ?? person.fullName}</p>
        <SlashFacts
          className="block mt-0.5 text-xs font-medium text-slate-500"
          parts={[lead && <span className="font-bold text-brand">{lead}</span>, <span className="break-all whitespace-normal">{person.email}</span>, ...facts]}
        />
      </div>
    </div>
    {children && <div className="flex flex-wrap gap-2 shrink-0">{children}</div>}
  </li>
);

export const GoverningBodyAdminsPage = () => {
  const { governingBody: cached } = useAuth();
  const { t, lang } = useT();
  const { showToast } = useOutletContext() ?? {};

  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);

  /* What is being asked: { kind: 'approve' | 'reject' | 'remove' | 'leave', row }. */
  const [asking, setAsking] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    governingBodyService
      .admins()
      .then((answer) => {
        setData(answer);
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

  const asDate = (value) => (value ? new Date(value).toLocaleDateString(localeOf(lang), { day: 'numeric', month: 'long', year: 'numeric' }) : null);

  /* The token traded in, then the one place left opened (useMoveOn says why). */
  const moveOn = useMoveOn();

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

  /* A refusal: out of date is a toast and a fresh read; the seat gone is the gone state; else it is said in place. */
  const refused = (err) => {
    setAsking(null);
    if (err?.status === 403 && !String(err?.message ?? '').includes('Only the senior admin')) {
      setState('gone');
      return;
    }
    showToast?.(governingBodySeatErrorMessage(err, t), isStaleSeat(err) ? 'info' : 'error');
    load();
  };

  const approve = async () => {
    const row = asking.row;
    setBusy(true);
    try {
      await governingBodyService.approveApplication(row.id);
      setAsking(null);
      showToast?.(t('gba.approve.done', { name: row.user.fullName }), 'success');
      load();
    } catch (err) {
      refused(err);
    } finally {
      setBusy(false);
    }
  };

  /* ReasonDialog shows a throw inside, by `describeError`; out-of-date and gone close it instead. */
  const withReason = (call, doneKey) => async (reason) => {
    const row = asking.row;
    try {
      await call(row.id, reason);
    } catch (err) {
      if (isStaleSeat(err) || err?.status === 403) {
        refused(err);
        return;
      }
      throw err;
    }
    setAsking(null);
    showToast?.(t(doneKey, { name: row.user.fullName }), 'success');
    load();
  };

  const leave = async () => {
    setBusy(true);
    try {
      await governingBodyService.leave();
      setAsking(null);
      if (!(await moveOn().catch(() => false))) setState('gone');
    } catch (err) {
      refused(err);
    } finally {
      setBusy(false);
    }
  };

  const name = cached?.name ?? '';
  const admins = data?.admins ?? [];
  const applications = data?.applications ?? [];
  const senior = seniorOf(admins);
  const youAreSenior = data?.youAreSenior === true;
  const leaving = leaveStateOf(admins);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('gba.title')}</h1>
        <SlashFacts
          className="block mt-2 text-sm font-medium text-slate-500"
          parts={[
            name,
            state === 'ready' && t('gba.count', { n: admins.length }),
            state === 'ready' && applications.length > 0 && <span className="font-bold text-amber-700">{t('gbs.waiting.subtitle', { n: applications.length })}</span>,
          ]}
        />
      </div>

      {state === 'loading' && <RowsLoading />}

      {state === 'gone' && <SeatGone onCheck={checkAgain} checking={checking} />}

      {state === 'failed' && (
        <div className={ADMIN_CARD}>
          <HomeError message={governingBodySeatErrorMessage(error, t)} retryLabel={t('gb.retry')} onRetry={load} />
        </div>
      )}

      {state === 'ready' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-6">
            <section className={ADMIN_CARD}>
              <h2 className={CARD_TITLE}>
                {t('gba.waiting')} <span className="ml-1 text-[13px] font-semibold text-slate-500 tabular-nums">{applications.length}</span>
              </h2>
              {!youAreSenior && senior && <p className="text-[13px] text-slate-500 leading-relaxed mt-1">{t('gba.waiting.notSenior', { name: senior.user.fullName, email: senior.user.email })}</p>}
              {applications.length === 0 ? (
                <p className="text-[13px] text-slate-500 mt-3">{t('gba.waiting.empty')}</p>
              ) : (
                <ul className="divide-y divide-slate-100 mt-1">
                  {applications.map((row) => (
                    <PersonRow key={row.id} person={row.user} facts={[t('gba.requestedAt', { date: asDate(row.requestedAt) })]}>
                      {youAreSenior && (
                        <>
                          <Button size="sm" onClick={() => setAsking({ kind: 'approve', row })}>
                            {t('gba.approve')}
                          </Button>
                          <Button size="sm" variant="dangerOutline" onClick={() => setAsking({ kind: 'reject', row })}>
                            {t('gba.reject')}
                          </Button>
                        </>
                      )}
                    </PersonRow>
                  ))}
                </ul>
              )}
            </section>

            <section className={ADMIN_CARD}>
              <h2 className={CARD_TITLE}>
                {t('gba.admins')} <span className="ml-1 text-[13px] font-semibold text-slate-500 tabular-nums">{admins.length}</span>
              </h2>
              <p className="text-[13px] text-slate-500 leading-relaxed mt-1">{t('gba.admins.lead')}</p>
              <ul className="divide-y divide-slate-100 mt-1">
                {admins.map((row) => (
                  <PersonRow
                    key={row.id}
                    person={{ ...row.user, displayName: row.you ? t('gba.you', { name: row.user.fullName }) : row.user.fullName }}
                    lead={row.senior && t('gba.senior')}
                    facts={[row.approvedAt && t('gba.approvedAt', { date: asDate(row.approvedAt) })]}
                  >
                    {youAreSenior && !row.you && (
                      <Button size="sm" variant="dangerOutline" onClick={() => setAsking({ kind: 'remove', row })}>
                        {t('gba.remove')}
                      </Button>
                    )}
                  </PersonRow>
                ))}
              </ul>
            </section>
          </div>

          <section className={`${ADMIN_CARD} space-y-3`}>
            <h2 className={CARD_TITLE}>{t('gba.leave.title')}</h2>
            <p className="text-[13px] text-slate-500 leading-relaxed">
              {leaving.state === 'LAST' ? t('gba.leave.last') : leaving.state === 'SENIOR' ? t('gba.leave.senior', { name: leaving.next.user.fullName, email: leaving.next.user.email }) : t('gba.leave.lead')}
            </p>
            <Button variant="dangerOutline" size="sm" onClick={() => setAsking({ kind: 'leave' })} isDisabled={leaving.state === 'LAST'}>
              {t('gba.leave.action')}
            </Button>
          </section>
        </div>
      )}

      <ConfirmDialog
        open={asking?.kind === 'approve'}
        title={t('gba.approve.title', { name: asking?.row?.user?.fullName ?? '' })}
        body={t('gba.approve.body')}
        confirmLabel={t('gba.approve')}
        cancelLabel={t('common.cancel')}
        tone="brand"
        busy={busy}
        busyLabel={t('common.loading')}
        onCancel={() => setAsking(null)}
        onConfirm={approve}
      />

      <ConfirmDialog
        open={asking?.kind === 'leave'}
        title={t('gba.leave.confirm.title', { name })}
        body={leaving.state === 'SENIOR' ? t('gba.leave.confirm.senior', { name: leaving.next.user.fullName, email: leaving.next.user.email }) : t('gba.leave.confirm.body')}
        confirmLabel={t('gba.leave.action')}
        cancelLabel={t('common.cancel')}
        busy={busy}
        busyLabel={t('common.loading')}
        onCancel={() => setAsking(null)}
        onConfirm={leave}
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
          onSubmit={withReason(governingBodyService.rejectApplication, 'gba.reject.done')}
          describeError={(err) => governingBodySeatErrorMessage(err, t)}
        />
      )}

      {asking?.kind === 'remove' && (
        <ReasonDialog
          key={`remove:${asking.row.id}`}
          title={t('gba.remove.title', { name: asking.row.user.fullName })}
          body={t('gba.remove.body')}
          label={t('gba.reason')}
          hint={t('gba.remove.hint')}
          confirmLabel={t('gba.remove')}
          onClose={() => setAsking(null)}
          onSubmit={withReason(governingBodyService.removeAdmin, 'gba.remove.done')}
          describeError={(err) => governingBodySeatErrorMessage(err, t)}
        />
      )}
    </div>
  );
};

export default GoverningBodyAdminsPage;
