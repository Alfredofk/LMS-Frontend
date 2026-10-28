import React, { useState } from 'react';

import Button from '../../components/ui/Button';
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

/* A move's state is a coloured word in the row's grey line, not a chip (owner, 2026-10-28). */
const STATUS_WORD = {
  PENDING: 'text-amber-700',
  ACTIVE: 'text-emerald-700',
  REJECTED: 'text-rose-700',
  CANCELLED: 'text-slate-600',
};

/* Parts of a grey line, set apart by light slashes. */
const Slashed = ({ parts }) => (
  <p className="text-[13px] text-slate-500 flex flex-wrap items-baseline">
    {parts.filter(Boolean).map((part, i) => (
      <React.Fragment key={i}>
        {i > 0 && (
          <span className="mx-1.5 text-slate-300" aria-hidden="true">
            /
          </span>
        )}
        <span>{part}</span>
      </React.Fragment>
    ))}
  </p>
);

export const ClassMovesSection = ({ moves, error, mineIds, onChanged, showToast }) => {
  const { t, lang } = useT();
  const [tab, setTab] = useState('PENDING');
  const [confirm, setConfirm] = useState(null); // { kind: 'approve'|'cancel', move }
  const [confirmError, setConfirmError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(null);

  const locale = lang === 'en' ? 'en-GB' : 'id-ID';
  const day = (value) =>
    value ? new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : '-';

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
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-extrabold text-slate-800 break-words">{move.student.fullName}</p>
          {/* State (history only) / direction / from-to / a grade change, then NISN / date:
              two grey lines in place of three chips and an arrow (owner, 2026-10-28). */}
          <Slashed
            parts={[
              tab === 'HISTORY' && <span className={`font-bold ${STATUS_WORD[move.status]}`}>{t(`moves.status.${move.status}`)}</span>,
              t(incoming ? 'moves.direction.in' : 'moves.direction.out'),
              t('moves.path', { from: move.fromClass.name, to: move.toClass.name }),
              changesGrade(move) && (
                <span className="font-bold text-amber-700">
                  {t('moves.gradeBadge', { from: move.fromClass.gradeLevel, to: move.toClass.gradeLevel })}
                </span>
              ),
            ]}
          />
          <Slashed
            parts={[
              <span className="tabular-nums">{`${t('profile.nisn')} ${move.student.nisn ?? '-'}`}</span>,
              tab === 'HISTORY' && move.decidedAt
                ? t('moves.decidedOn', { date: day(move.decidedAt) })
                : t('moves.requestedOn', { date: day(move.requestedAt) }),
            ]}
          />
          {move.reason && (
            <p className="mt-1.5 pl-2 border-l-2 border-slate-200 text-[12.5px] text-slate-600 font-semibold break-words">
              {move.reason}
            </p>
          )}
          {move.status === 'REJECTED' && move.rejectionReason && (
            <p className="mt-1.5 pl-2 border-l-2 border-rose-200 text-[12.5px] text-rose-700 font-semibold break-words">
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
      <Button size="sm" variant="dangerOutline" onClick={() => setRejecting(move)}>
        {t('moves.reject')}
      </Button>
      <Button size="sm" onClick={() => setConfirm({ kind: 'approve', move })}>
        {t('moves.approve')}
      </Button>
    </>
  );

  const cancelButton = (move) => (
    <Button size="sm" variant="outline" onClick={() => setConfirm({ kind: 'cancel', move })}>
      {t('moves.cancel')}
    </Button>
  );

  const group = (heading, list, actionsFor) =>
    list.length > 0 && (
      <div>
        <h3 className="text-sm font-extrabold text-slate-900">{heading}</h3>
        <ul className="divide-y divide-slate-100">{list.map((move) => row(move, actionsFor(move)))}</ul>
      </div>
    );

  return (
    <section className="bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm space-y-4">
      <h2 className="text-base font-extrabold text-slate-900">{t('moves.title')}</h2>

      {/* The dashboards' text tabs; the waiting count amber while a move waits on this teacher. */}
      <div className="flex gap-0.5 select-none overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-[inset_0_-1px_0_var(--color-slate-100)]">
        {MOVE_TABS.map((name) => {
          const isActive = tab === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              aria-pressed={isActive}
              className={`px-2.5 py-2 text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus-visible:text-brand ${
                isActive ? 'text-brand border-brand' : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              {t(`moves.tab.${name}`)}
              {moves && counts[name] > 0 && (
                <span
                  className={`ml-1.5 px-1.5 rounded-full text-[11px] tabular-nums ${
                    name === 'PENDING' && decide.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
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
        <div className="rounded-xl bg-rose-50 p-3.5 text-[13px] text-rose-700 font-semibold" role="alert">
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
