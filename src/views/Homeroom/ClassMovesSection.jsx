import React, { useState } from 'react';
import { ArrowRight, ArrowRightLeft, Check, X } from 'lucide-react';

import ConfirmDialog from '../../components/ui/ConfirmDialog';
import ReasonDialog from '../../components/ReasonDialog';
import { academicsService } from '../../services/academicsService';
import { useT } from '../../i18n/LanguageContext';
import { movesErrorMessage, isStaleMove } from '../../i18n/apiError';
import { MOVE_TABS, splitMoves, changesGrade } from './moves';

/*
  Class moves on the homeroom teacher's page (owner, 2026-09-26) — ticket 16.

  Two tabs. **Waiting**: moves into the reader's classes, for them to accept or
  reject (a reason is required, the other teacher reads it), and moves they
  asked for, which they can take back. **History**: everything decided or
  withdrawn, so the teacher who asked learns the answer and the reason. Which
  buttons are whose is the server's `canDecide` / `canCancel`.

  Accepting moves the student at once (the old placement ends and stays as
  history). A move decided or withdrawn elsewhere closes its dialog, says so and
  re-reads — the row it was about is gone.
*/

const STATUS_STYLE = {
  PENDING: 'bg-amber-100 text-amber-800',
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-rose-50 text-rose-700',
  CANCELLED: 'bg-slate-100 text-slate-600',
};

export const ClassMovesSection = ({ moves, error, mineIds, onChanged, showToast }) => {
  const { t, lang } = useT();
  const [tab, setTab] = useState('PENDING');
  const [confirm, setConfirm] = useState(null); // { kind: 'approve'|'cancel', move }
  const [confirmError, setConfirmError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(null);

  const locale = lang === 'en' ? 'en-GB' : 'id-ID';
  const day = (value) =>
    value ? new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  const { decide, waiting, history } = splitMoves(moves);
  const counts = { PENDING: decide.length + waiting.length, HISTORY: history.length };

  const stale = (err) => {
    showToast(movesErrorMessage(err, t), 'error');
    onChanged();
  };

  const closeConfirm = () => {
    setConfirm(null);
    setConfirmError(null);
  };

  const handleConfirm = async () => {
    const { kind, move } = confirm;
    setBusy(true);
    try {
      if (kind === 'approve') {
        await academicsService.approveMove(move.id);
        showToast(t('moves.approve.done', { name: move.student.fullName, to: move.toClass.name }), 'success');
      } else {
        await academicsService.cancelMove(move.id);
        showToast(t('moves.cancel.done', { name: move.student.fullName }), 'success');
      }
      closeConfirm();
      onChanged();
    } catch (err) {
      if (isStaleMove(err)) {
        closeConfirm();
        stale(err);
      } else {
        setConfirmError(movesErrorMessage(err, t));
      }
    } finally {
      setBusy(false);
    }
  };

  const row = (move, actions) => {
    const incoming = mineIds.has(move.toClass.id);
    return (
      <li key={move.id} className="py-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-extrabold text-slate-800 break-words">{move.student.fullName}</span>
            {tab === 'HISTORY' && (
              <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md ${STATUS_STYLE[move.status]}`}>
                {t(`moves.status.${move.status}`)}
              </span>
            )}
            <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-slate-100 text-slate-600">
              {t(incoming ? 'moves.direction.in' : 'moves.direction.out')}
            </span>
          </div>
          <p className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-700">
            <span>{move.fromClass.name}</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" aria-label={t('moves.to')} />
            <span>{move.toClass.name}</span>
            {changesGrade(move) && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800">
                {t('moves.gradeBadge', { from: move.fromClass.gradeLevel, to: move.toClass.gradeLevel })}
              </span>
            )}
          </p>
          <p className="text-[11px] font-semibold text-slate-500 tabular-nums">
            {t('profile.nisn')} {move.student.nisn ?? '—'} ·{' '}
            {tab === 'HISTORY' && move.decidedAt
              ? t('moves.decidedOn', { date: day(move.decidedAt) })
              : t('moves.requestedOn', { date: day(move.requestedAt) })}
          </p>
          {move.reason && (
            <p className="mt-1 pl-2 border-l-2 border-slate-200 text-[11px] text-slate-600 font-semibold break-words">
              {move.reason}
            </p>
          )}
          {move.status === 'REJECTED' && move.rejectionReason && (
            <p className="mt-1 pl-2 border-l-2 border-rose-200 text-[11px] text-rose-700 font-semibold break-words">
              {t('moves.rejectedBecause')} “{move.rejectionReason}”
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
      </li>
    );
  };

  const decideButtons = (move) => (
    <>
      <button
        type="button"
        onClick={() => setRejecting(move)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-extrabold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
      >
        <X className="w-4 h-4 shrink-0" aria-hidden="true" />
        {t('moves.reject')}
      </button>
      <button
        type="button"
        onClick={() => setConfirm({ kind: 'approve', move })}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand hover:bg-brand-deep text-white text-xs font-extrabold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
        {t('moves.approve')}
      </button>
    </>
  );

  const cancelButton = (move) => (
    <button
      type="button"
      onClick={() => setConfirm({ kind: 'cancel', move })}
      className="text-xs font-extrabold text-rose-600 hover:text-rose-700 underline underline-offset-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded"
    >
      {t('moves.cancel')}
    </button>
  );

  const group = (heading, list, actionsFor) =>
    list.length > 0 && (
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{heading}</h3>
        <ul className="divide-y divide-slate-100">{list.map((move) => row(move, actionsFor(move)))}</ul>
      </div>
    );

  return (
    <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 text-slate-500">
        <ArrowRightLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
        <h2 className="text-[11px] font-bold uppercase tracking-wider">{t('moves.title')}</h2>
      </div>

      <div className="border-b border-slate-100 flex gap-6 select-none">
        {MOVE_TABS.map((name) => {
          const isActive = tab === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              aria-pressed={isActive}
              className={`pb-2.5 text-sm font-extrabold transition-all border-b-2 cursor-pointer focus:outline-none flex items-center gap-2 ${
                isActive ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-600'
              }`}
            >
              {t(`moves.tab.${name}`)}
              {moves && counts[name] > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold tabular-nums ${
                    name === 'PENDING' && decide.length > 0
                      ? 'bg-amber-100 text-amber-800'
                      : isActive
                        ? 'bg-brand-tint text-brand'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {counts[name]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
          {error}
        </div>
      ) : moves === null ? (
        <div className="h-16 bg-slate-50 rounded-xl animate-pulse" aria-label={t('common.loading')} />
      ) : tab === 'PENDING' ? (
        counts.PENDING === 0 ? (
          <p className="text-xs font-semibold text-slate-500 leading-relaxed">{t('moves.empty.PENDING')}</p>
        ) : (
          <div className="space-y-4">
            {group(t('moves.group.decide'), decide, decideButtons)}
            {group(t('moves.group.waiting'), waiting, cancelButton)}
          </div>
        )
      ) : history.length === 0 ? (
        <p className="text-xs font-semibold text-slate-500 leading-relaxed">{t('moves.empty.HISTORY')}</p>
      ) : (
        <ul className="divide-y divide-slate-100">{history.map((move) => row(move, null))}</ul>
      )}

      <p className="text-[11px] font-semibold text-slate-500 leading-relaxed">{t('moves.hint')}</p>

      <ConfirmDialog
        open={!!confirm}
        tone={confirm?.kind === 'approve' ? 'brand' : 'danger'}
        title={
          confirm
            ? confirm.kind === 'approve'
              ? t('moves.approve.title', { name: confirm.move.student.fullName, to: confirm.move.toClass.name })
              : t('moves.cancel.title', { name: confirm.move.student.fullName })
            : ''
        }
        body={
          confirmError ??
          (confirm
            ? confirm.kind === 'approve'
              ? t('moves.approve.body', { from: confirm.move.fromClass.name, to: confirm.move.toClass.name })
              : t('moves.cancel.body', { to: confirm.move.toClass.name })
            : '')
        }
        confirmLabel={confirm?.kind === 'approve' ? t('moves.approve') : t('selectRole.cancel.confirm')}
        cancelLabel={confirm?.kind === 'approve' ? t('common.cancel') : t('selectRole.cancel.keep')}
        busy={busy}
        busyLabel={t('common.loading')}
        onCancel={closeConfirm}
        onConfirm={handleConfirm}
      />

      {rejecting && (
        <ReasonDialog
          key={rejecting.id}
          title={t('moves.reject.title', { name: rejecting.student.fullName })}
          body={t('moves.reject.body', { from: rejecting.fromClass.name })}
          label={t('moves.reject.reason')}
          hint={t('moves.reject.hint')}
          confirmLabel={t('moves.reject.confirm')}
          onClose={() => setRejecting(null)}
          describeError={(err) => movesErrorMessage(err, t)}
          onSubmit={async (reason) => {
            try {
              await academicsService.rejectMove(rejecting.id, reason);
            } catch (err) {
              if (!isStaleMove(err)) throw err;
              setRejecting(null);
              stale(err);
              return;
            }
            showToast(t('moves.reject.done', { name: rejecting.student.fullName }), 'success');
            setRejecting(null);
            onChanged();
          }}
        />
      )}
    </section>
  );
};

export default ClassMovesSection;
