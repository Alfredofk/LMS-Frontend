import React, { useState } from 'react';
import { Check, ClipboardCheck, X } from 'lucide-react';

import ConfirmDialog from '../../components/ui/ConfirmDialog';
import ReasonDialog from '../../components/ReasonDialog';
import { academicsService } from '../../services/academicsService';
import { useT } from '../../i18n/LanguageContext';
import { subjectsErrorMessage, isStaleTeaching } from '../../i18n/apiError';
import { bulkOutcome } from './subjects';

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
*/
export const TeachingQueue = ({ requests, error, onChanged, showToast }) => {
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
    value ? new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

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
      <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl text-sm text-red-700" role="alert">
        {error}
      </div>
    );
  }

  if (requests === null) {
    return <div className="h-48 bg-white border border-slate-100 rounded-2xl animate-pulse" aria-label={t('common.loading')} />;
  }

  const allTicked = requests.length > 0 && requests.every((request) => ticked.has(request.id));

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 font-medium leading-relaxed">{t('subjects.queue.hint')}</p>

      {failures.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-1.5" role="status">
          <p className="text-xs font-extrabold text-amber-800">{t('subjects.queue.bulk.failedTitle')}</p>
          <ul className="space-y-1">
            {failures.map(({ request, message }) => (
              <li key={request.id} className="text-[11px] font-semibold text-amber-800 break-words">
                {request.teacher.fullName} · {request.subject.code} · {request.class.name} — {message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {requests.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-white select-none">
          <ClipboardCheck className="w-9 h-9 text-slate-300 mx-auto" aria-hidden="true" />
          <p className="mt-2.5 text-xs font-extrabold text-slate-500">{t('subjects.queue.empty')}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allTicked}
                onChange={() => setTicked(allTicked ? new Set() : new Set(requests.map((request) => request.id)))}
                className="w-4 h-4 accent-brand cursor-pointer"
              />
              {t('subjects.queue.selectAll')}
            </label>
            {ticked.size > 0 && (
              <button
                type="button"
                onClick={() => setApproving('BULK')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand hover:bg-brand-deep text-white text-xs font-extrabold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                {t('subjects.queue.bulk.open', { n: ticked.size })}
              </button>
            )}
          </div>

          <ul className="bg-white border border-slate-100 rounded-2xl shadow-sm divide-y divide-slate-100">
            {requests.map((request) => (
              <li key={request.id} className="px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={ticked.has(request.id)}
                    onChange={() => toggle(request.id)}
                    aria-label={t('subjects.queue.tick', { teacher: request.teacher.fullName, subject: request.subject.name })}
                    className="mt-1 w-4 h-4 accent-brand cursor-pointer shrink-0"
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-extrabold text-slate-800 break-words">{request.teacher.fullName}</p>
                    <p className="text-xs font-bold text-slate-700 break-words">
                      <span className="tabular-nums text-slate-500">{request.subject.code}</span> · {request.subject.name}
                      {' · '}
                      {request.class.name}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500">
                      {t('subjects.queue.when', {
                        n: request.semester.ordinal,
                        year: request.semester.academicYear,
                        date: day(request.requestedAt),
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0 pl-7 lg:pl-0">
                  <button
                    type="button"
                    onClick={() => setRejecting(request)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-extrabold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                  >
                    <X className="w-4 h-4 shrink-0" aria-hidden="true" />
                    {t('subjects.queue.reject')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setApproving(request)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand hover:bg-brand-deep text-white text-xs font-extrabold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                    {t('subjects.queue.approve')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
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
