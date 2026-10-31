import React, { useState } from 'react';
import { ClipboardCheck, Info } from 'lucide-react';

import ConfirmDialog from '../../components/ui/ConfirmDialog';
import ReasonDialog from '../../components/ReasonDialog';
import { academicsService } from '../../services/academicsService';
import { useT } from '../../i18n/LanguageContext';
import { subjectsErrorMessage, isStaleTeaching } from '../../i18n/apiError';
import { bulkOutcome, isOwnRequest } from './subjects';
import FactLine from '../../components/ui/FactLine';
import EmptyCard from '../../components/ui/EmptyCard';
import { HomeError } from '../Dashboard/components/HomeCard';
import Button from '../../components/ui/Button';
import { RowsLoading } from '../GoverningBody/bodyParts';
import { initialsOf } from '../../utils/names';

/*
  Teachers asking to teach a subject in a class — the Principal's queue,
  `GET /academics/class-subjects` (PENDING, oldest first). A homeroom teacher's
  own class never reaches it: that is ACTIVE at once.

  Approve asks first; reject needs a reason (3–500), which the teacher reads.
  Several can be approved at once (`POST /class-subjects/approve`, ≤ 100 ids,
  each in its own transaction): the outcome is said per name, because one taken
  slot must not hide that the other twenty went through. There is no bulk
  reject in the backend. A request decided elsewhere closes its dialog and
  re-reads the queue.

  `selfId` is set for a Vice Principal (ticket 19): the queue is theirs to run,
  except their own requests, which the server refuses them (403). Those rows are
  shown with a line saying who decides, and no box and no buttons.
*/
export const TeachingQueue = ({ requests, error, onChanged, showToast, selfId = null }) => {
  const { t, lang } = useT();
  const [ticked, setTicked] = useState(() => new Set());
  const [approving, setApproving] = useState(null); // one request, or 'BULK'
  const [confirmError, setConfirmError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(null);
  const [failures, setFailures] = useState([]);

  /* A new queue means new rows: nothing out of view stays ticked. Adjusted
     while rendering, the pattern React documents, rather than in an effect. */
  const [seen, setSeen] = useState(requests);
  if (seen !== requests) {
    setSeen(requests);
    setTicked(new Set());
  }

  const locale = lang === 'en' ? 'en-GB' : 'id-ID';
  const day = (value) =>
    value ? new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

  const toggle = (id) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const close = () => {
    setApproving(null);
    setConfirmError(null);
  };

  const handleApprove = async () => {
    setBusy(true);
    try {
      if (approving === 'BULK') {
        const chosen = requests.filter((request) => ticked.has(request.id));
        const answer = await academicsService.approveClassSubjects(chosen.map((request) => request.id));
        const outcome = bulkOutcome(chosen, answer?.results);
        setFailures(
          outcome.failed.map(({ request, error: failure }) => ({
            request,
            message: subjectsErrorMessage(failure ?? {}, t),
          }))
        );
        showToast(
          outcome.failed.length
            ? t('subjects.queue.bulk.mixed', { approved: outcome.approved, failed: outcome.failed.length })
            : t('subjects.queue.bulk.done', { n: outcome.approved }),
          outcome.failed.length ? 'info' : 'success'
        );
      } else {
        await academicsService.approveClassSubject(approving.id);
        setFailures([]);
        showToast(
          t('subjects.queue.approve.done', { teacher: approving.teacher.fullName, subject: approving.subject.name }),
          'success'
        );
      }
      close();
      onChanged();
    } catch (err) {
      if (isStaleTeaching(err)) {
        close();
        showToast(subjectsErrorMessage(err, t), 'error');
        onChanged();
      } else {
        setConfirmError(subjectsErrorMessage(err, t));
      }
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <HomeError message={error} />
    );
  }

  if (requests === null) {
    return <RowsLoading />;
  }

  const decidable = requests.filter((request) => !isOwnRequest(request, selfId));
  const allTicked = decidable.length > 0 && decidable.every((request) => ticked.has(request.id));

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 text-[13px] font-medium text-slate-600 leading-relaxed">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
        {t('subjects.queue.hint')}
      </p>

      {failures.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-1.5" role="status">
          <p className="text-xs font-extrabold text-amber-800">{t('subjects.queue.bulk.failedTitle')}</p>
          <ul className="space-y-1">
            {failures.map(({ request, message }) => (
              <li key={request.id} className="text-[11px] font-semibold text-amber-800 break-words">
                {request.teacher.fullName} ({request.subject.code}, {request.class.name}): {message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {requests.length === 0 ? (
        <EmptyCard icon={ClipboardCheck} title={t('subjects.queue.empty')} />
      ) : (
        /* One card of rows as on Permintaan bergabung (owner, 2026-10-31, mockup item 10):
           the "N dipilih" bar on its top edge, a row's box beside its initials,
           Tolak and Setujui the app's buttons. */
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm min-w-0">
          {ticked.size > 0 && (
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 bg-brand-tint rounded-t-2xl border-b border-slate-100 px-[18px] py-2.5" aria-live="polite">
              <span className="text-[13px] font-bold text-brand">{t('requests.bulk.ticked', { n: ticked.size })}</span>
              <span className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setTicked(new Set())}
                  className="text-xs font-bold text-slate-600 hover:text-slate-800 cursor-pointer focus:outline-none focus-visible:underline"
                >
                  {t('requests.bulk.clear')}
                </button>
                <Button size="sm" onClick={() => setApproving('BULK')}>
                  {t('subjects.queue.bulk.open', { n: ticked.size })}
                </Button>
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 px-[18px] py-3 border-b border-slate-100">
            <p className="text-[13px] font-extrabold text-slate-900 select-none">{t('subjects.queue.count', { n: requests.length })}</p>
            {decidable.length > 1 && (
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allTicked}
                  onChange={() => setTicked(allTicked ? new Set() : new Set(decidable.map((request) => request.id)))}
                  className="w-4 h-4 rounded accent-brand cursor-pointer"
                />
                {t('requests.bulk.selectAll', { n: decidable.length })}
              </label>
            )}
          </div>

          <ul>
            {requests.map((request) => {
              const own = isOwnRequest(request, selfId);
              return (
                <li key={request.id} className="flex items-start gap-3 px-[18px] py-3.5 border-b border-slate-100 last:border-0">
                  {own ? (
                    <span className="w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <input
                      type="checkbox"
                      checked={ticked.has(request.id)}
                      onChange={() => toggle(request.id)}
                      aria-label={t('subjects.queue.tick', { teacher: request.teacher.fullName, subject: request.subject.name })}
                      className="mt-3 w-4 h-4 shrink-0 rounded accent-brand cursor-pointer"
                    />
                  )}
                  <span className="w-10 h-10 rounded-full bg-brand-tint text-brand text-xs font-extrabold flex items-center justify-center shrink-0 select-none" aria-hidden="true">
                    {initialsOf(request.teacher.fullName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-slate-900 break-words">{request.teacher.fullName}</p>
                    {/* The subject, class, semester and day in one grey line. */}
                    <FactLine
                      size="xs"
                      wrap
                      className="mt-0.5 font-medium"
                      code={request.subject.code}
                      name={request.subject.name}
                      facts={[
                        request.class.name,
                        t('subjects.queue.semester', { n: request.semester.ordinal, year: request.semester.academicYear }),
                        t('subjects.queue.asked', { date: day(request.requestedAt) }),
                      ]}
                    />
                    {own ? (
                      <p className="mt-1 text-xs font-semibold text-amber-800">{t('subjects.queue.own')}</p>
                    ) : (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <Button size="sm" variant="dangerOutline" onClick={() => setRejecting(request)}>
                          {t('subjects.queue.reject')}
                        </Button>
                        <Button size="sm" onClick={() => setApproving(request)}>
                          {t('subjects.queue.approve')}
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={!!approving}
        tone="brand"
        title={
          approving === 'BULK'
            ? t('subjects.queue.bulk.title', { n: ticked.size })
            : approving
              ? t('subjects.queue.approve.title', { teacher: approving.teacher.fullName, subject: approving.subject.name })
              : ''
        }
        body={
          confirmError ??
          (approving === 'BULK'
            ? t('subjects.queue.bulk.body')
            : approving
              ? t('subjects.queue.approve.body', { className: approving.class.name, n: approving.semester.ordinal, year: approving.semester.academicYear })
              : '')
        }
        confirmLabel={t('subjects.queue.approve')}
        cancelLabel={t('common.cancel')}
        busy={busy}
        busyLabel={t('common.loading')}
        onCancel={close}
        onConfirm={handleApprove}
      />

      {rejecting && (
        <ReasonDialog
          key={rejecting.id}
          title={t('subjects.queue.reject.title', { teacher: rejecting.teacher.fullName, subject: rejecting.subject.name })}
          body={t('subjects.queue.reject.body')}
          label={t('subjects.queue.reject.reason')}
          hint={t('subjects.queue.reject.hint')}
          confirmLabel={t('subjects.queue.reject.confirm')}
          onClose={() => setRejecting(null)}
          describeError={(err) => subjectsErrorMessage(err, t)}
          onSubmit={async (reason) => {
            try {
              await academicsService.rejectClassSubject(rejecting.id, reason);
            } catch (err) {
              if (!isStaleTeaching(err)) throw err;
              setRejecting(null);
              showToast(subjectsErrorMessage(err, t), 'error');
              onChanged();
              return;
            }
            showToast(t('subjects.queue.reject.done', { teacher: rejecting.teacher.fullName }), 'success');
            setRejecting(null);
            setFailures([]);
            onChanged();
          }}
        />
      )}
    </div>
  );
};

export default TeachingQueue;
