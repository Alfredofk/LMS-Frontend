import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, X, Lock, School } from 'lucide-react';

import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import SelectField from '../../components/ui/SelectField';
import { membershipReviewService } from '../../services/membershipReviewService';
import { academicsService } from '../../services/academicsService';
import { useAuth } from '../../context/AuthContext';
import { ROLES, ROLE_LABEL_KEY, releasableInPov, releasableLinksInPov } from '../../constants/roles';
import { classesFor } from './bulk';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage, decisionErrorMessage, isAlreadyDecided } from '../../i18n/apiError';

const MIN_REASON = 3;
const MAX_REASON = 500;

/*
  Releasing a STUDENT places them in a class, so the approval must name one.

  `resolveTargetClass` (membership.service.js) accepts a class only if the
  reviewer is its homeroom teacher and its grade is the one the student asked
  for; anything else is 404 or 400. The requests themselves never carry the
  reviewer's classes, but `GET /api/academics/classes` does since backend
  `36476f3` — a teacher gets exactly the classes they are homeroom of, a
  Principal gets every class, so the list is narrowed here to the reader's own.

  **Only classes in an ACTIVE academic year are offered.** The backend would
  also accept a class in a closed year, and place a new student in a year that
  has finished — the owner's decision (2026-09-24) was not to offer that. When
  the only match is in a closed year, the screen says so rather than offering
  nothing without a reason.

  Every refusal that can still come back gets its own sentence through
  decisionErrorMessage (i18n/apiError.js): no class, a grade that does not
  match, a class no longer the reviewer's — and a NISN already at this school,
  which is a CONFLICT like "decided elsewhere" but means something else.
*/

/* The reader's own classes at this grade: shared with bulk approval (./bulk.js). */

/* Local, like RegistrationReview's own copy. Ten presentational lines are not
   worth a shared module that two folders then have to agree about. */
const Row = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
      {label}
    </span>
    <span className="text-xs font-semibold text-slate-800 text-right break-words min-w-0">
      {children ?? '—'}
    </span>
  </div>
);

/*
  One join request, and the decision about it.

  **What may be released is the backend's answer, not ours.** Every role in the
  response carries `canRelease`, worked out from class rosters this app cannot
  see — a TEACHER is the Principal's to release, a STUDENT belongs to a homeroom
  teacher of that grade, a GUARDIAN to the homeroom teacher of the child's class.
  Re-deriving any of that here would be guessing at data we were not given.

  A Principal may **read** the whole queue even where the release is somebody
  else's, which is why a request with nothing releasable still renders in full
  and simply has no buttons. It says whose decision it is instead of pretending
  the request does not exist.

  **A decision happens once.** Each role is claimed with
  `updateMany({ status: 'PENDING' })` inside the transaction, so two reviewers
  clicking together both pass the earlier read and only one wins; the other gets
  409. That is not a failure — somebody else did the work — so it reloads and
  says so.
*/
export const JoinRequestReview = ({ request, onBack, onDecided, showToast }) => {
  const { t, lang } = useT();
  const { membership, activeRole } = useAuth();

  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(null);
  const [confirming, setConfirming] = useState(null); // 'approve' | 'reject' | null
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);

  const locale = lang === 'en' ? 'en-GB' : 'id-ID';
  const asDate = (value) =>
    value
      ? new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
      : null;

  const roles = request.roles ?? [];
  /*
    What this desk may release: the backend's canRelease, narrowed to the active
    role's kinds (releasableInPov). A Principal who is also homeroom teacher
    releases teachers as Principal and students as Teacher — never both at once.

    The backend cannot be told to release only part: approve and reject act on
    every role the reviewer may release. So when a role outside this desk is
    releasable too — a teacher who is also a guardian of a child in the reader's
    own class — the dialog says it goes with it, rather than doing it silently.
  */
  const releasable = releasableInPov(request, activeRole);
  const alongside = roles.filter((entry) => entry.canRelease && !releasable.includes(entry));
  const alongsideNames = alongside.map((entry) => t(ROLE_LABEL_KEY[entry.role] ?? 'requests.role.unknown')).join(', ');
  const isPending = request.status === 'PENDING';
  /*
    A further child: a guardian already ACTIVE here claims another child
    (POST /me/children). Only the link waits — the membership and its GUARDIAN
    role were decided long ago — and the backend approves or rejects it alone
    through the same two routes ("link alone", decideRequest). Deciding it needs
    no class: the child already sits in one.
  */
  const links = releasableLinksInPov(request, activeRole);
  const linkOnly = !isPending && links.length > 0;
  const linkNames = links.map((link) => `${link.student?.fullName ?? '—'} (${link.relationship})`).join(', ');
  const canDecide = (isPending && releasable.length > 0) || links.length > 0;
  const releasingStudent = releasable.some((entry) => entry.role === ROLES.STUDENT);
  const grade = request.student?.gradeLevel ?? null;

  /*
    Asked for only when a student is about to be released by this reader —
    a teacher or a rejection needs no class, and neither does a Principal
    reading a request that is somebody else's.
  */
  const needsClass = isPending && releasingStudent;
  const [classes, setClasses] = useState(null);
  const [classesError, setClassesError] = useState(null);
  const [classId, setClassId] = useState('');

  useEffect(() => {
    if (!needsClass) return undefined;
    let cancelled = false;
    academicsService
      .classes()
      .then((list) => {
        if (cancelled) return;
        setClasses(list);
        /* One possible class is the answer; picking it for them saves a step
           without hiding it — the select still shows what was chosen. */
        const { open } = classesFor(list, membership?.id, grade);
        if (open.length === 1) setClassId(open[0].id);
      })
      .catch((err) => !cancelled && setClassesError(apiErrorMessage(err, t)));
    return () => {
      cancelled = true;
    };
  }, [needsClass, membership?.id, grade, t]);

  const { open: openClasses, closedOnly } = classesFor(classes ?? [], membership?.id, grade);
  const chosenClass = openClasses.find((entry) => entry.id === classId) ?? null;
  const approveBlocked = needsClass && !chosenClass;

  const applicantName = request.applicant?.fullName ?? t('requests.applicant.unnamed');

  const checkReason = () => {
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON) {
      setReasonError(t('requests.reject.reason.required'));
      return false;
    }
    if (trimmed.length > MAX_REASON) {
      setReasonError(t('requests.reject.reason.long'));
      return false;
    }
    setReasonError(null);
    return true;
  };

  const decide = async (kind) => {
    setConfirming(null);
    setIsSending(true);
    setError(null);

    try {
      const answer =
        kind === 'approve'
          ? await membershipReviewService.approve(request.id, needsClass ? chosenClass?.id : undefined)
          : await membershipReviewService.reject(request.id, reason.trim());

      showToast?.(t(kind === 'approve' ? 'requests.approve.done' : 'requests.reject.done'), 'success');
      onDecided(answer.request);
    } catch (err) {
      if (isAlreadyDecided(err)) {
        /* Somebody decided first. Nothing is wrong; the queue is just stale. */
        showToast?.(t('requests.alreadyDecided'), 'info');
        onDecided(null);
        return;
      }
      /* Any other refusal stays on this screen, in words that say which it is —
         a NISN already at the school used to be taken for "decided" and the
         request vanished from view while still waiting. */
      setError(decisionErrorMessage(err, t));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-500 hover:text-brand transition-colors cursor-pointer focus:outline-none focus-visible:text-brand"
      >
        <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
        {t('requests.back')}
      </button>

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight mb-2">
              {t('requests.section.applicant')}
            </h3>
            <Row label={t('requests.field.name')}>{request.applicant?.fullName}</Row>
            <Row label={t('requests.field.email')}>{request.applicant?.email}</Row>
            <Row label={t('requests.field.status')}>{t(`requests.status.${request.status}`)}</Row>
            {linkOnly && (
              <p className="mt-2 text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 leading-relaxed">
                {t('requests.link.notice')}
              </p>
            )}
            <Row label={t('requests.field.requested')}>{asDate(request.requestedAt)}</Row>
            {request.approvedAt && (
              <Row label={t('requests.field.approved')}>{asDate(request.approvedAt)}</Row>
            )}
          </section>

          {/*
            Every role, releasable or not. A Principal reading a request whose
            release belongs to a homeroom teacher should see what was asked for —
            hiding it would leave them looking at a request with nothing in it.
          */}
          <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight mb-3">
              {t('requests.section.roles')}
            </h3>
            <div className="space-y-2">
              {roles.map((entry) => (
                <div
                  key={entry.role}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-800 truncate">
                      {t(ROLE_LABEL_KEY[entry.role] ?? 'requests.role.unknown')}
                    </p>
                    {entry.rejectionReason && (
                      <p className="text-[11px] font-semibold text-slate-500 mt-0.5 break-words">
                        {entry.rejectionReason}
                      </p>
                    )}
                  </div>

                  {releasable.includes(entry) ? (
                    <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-brand-tint text-brand">
                      {t('requests.role.yours')}
                    </span>
                  ) : (
                    <span
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-500"
                      title={t('requests.role.notYours.hint')}
                    >
                      <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />
                      {t('requests.role.notYours')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          {request.teacher && (
            <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm">
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight mb-2">
                {t('requests.section.teacher')}
              </h3>
              <Row label={t('requests.field.nip')}>{request.teacher.nip}</Row>
              <Row label={t('requests.field.nuptk')}>{request.teacher.nuptk}</Row>
            </section>
          )}

          {request.student && (
            <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm">
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight mb-2">
                {t('requests.section.student')}
              </h3>
              <Row label={t('requests.field.nisn')}>{request.student.nisn}</Row>
              <Row label={t('requests.field.birthDate')}>{asDate(request.student.birthDate)}</Row>
              <Row label={t('requests.field.gradeLevel')}>
                {request.student.gradeLevel != null
                  ? t('requests.field.grade', { n: request.student.gradeLevel })
                  : null}
              </Row>
            </section>
          )}

          {request.children?.length > 0 && (
            <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm">
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight mb-2">
                {t('requests.section.children')}
              </h3>
              {request.children.map((link) => (
                <Row key={link.id} label={link.relationship}>
                  {link.student?.fullName}
                  {link.student?.nisn ? ` · ${link.student.nisn}` : ''}
                  {/* Whose link this is, beside the child it names. */}
                  {links.includes(link) ? (
                    <span className="ml-2 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-brand-tint text-brand">
                      {t('requests.role.yours')}
                    </span>
                  ) : (
                    <span className="ml-2 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-500">
                      {t(`requests.link.status.${link.status}`)}
                    </span>
                  )}
                </Row>
              ))}
            </section>
          )}

          {canDecide && (
            <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm space-y-4">
              {needsClass && (
                <div className="space-y-2 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500">
                    <School className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <h3 className="text-[11px] font-bold uppercase tracking-wider">
                      {t('requests.class.heading')}
                    </h3>
                  </div>

                  {classesError ? (
                    <p className="text-xs font-semibold text-red-600" role="alert">{classesError}</p>
                  ) : classes === null ? (
                    <div className="h-12 bg-slate-50 rounded-xl animate-pulse" aria-label={t('common.loading')} />
                  ) : openClasses.length === 0 ? (
                    <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 leading-relaxed">
                      {t(closedOnly ? 'requests.class.onlyClosed' : 'requests.class.none', { n: grade ?? '—' })}
                    </p>
                  ) : (
                    <>
                      <SelectField
                        id="targetClass"
                        label={t('requests.class.label', { n: grade ?? '—' })}
                        value={classId}
                        onChange={(e) => setClassId(e.target.value)}
                      >
                        <option value="">{t('requests.class.placeholder')}</option>
                        {openClasses.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {t('requests.class.option', {
                              name: entry.name,
                              year: entry.academicYear?.label ?? '',
                              n: entry.studentCount ?? 0,
                            })}
                          </option>
                        ))}
                      </SelectField>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                        {t('requests.class.hint')}
                      </p>
                    </>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="reason" className="text-sm font-semibold text-slate-700 block">
                  {t('requests.reject.reason')}
                </label>
                <textarea
                  id="reason"
                  rows={3}
                  maxLength={MAX_REASON}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (reasonError) setReasonError(null);
                  }}
                  className="block w-full rounded-xl border border-slate-200 hover:border-slate-300 bg-white py-2.5 px-4 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                />
                {reasonError ? (
                  <span className="text-xs text-red-500 font-medium" role="alert">{reasonError}</span>
                ) : (
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    {t('requests.reject.reason.hint')}
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  isLoading={isSending}
                  isDisabled={approveBlocked}
                  onClick={() => setConfirming('approve')}
                  className="flex-1 py-3 rounded-2xl justify-center text-sm gap-1.5"
                >
                  <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {t('requests.approve')}
                </Button>

                {/* Not a Button: the danger action should not wear the primary
                    colour beside the one it is the opposite of. */}
                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => { if (checkReason()) setConfirming('reject'); }}
                  className="flex-1 py-3 rounded-2xl border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 text-sm font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  <X className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {t('requests.reject')}
                </button>
              </div>
            </section>
          )}

          {/*
            Still waiting, but not on this reader. Saying so is the point: a
            Principal who sees a student request sitting here needs to know it is
            the homeroom teacher's to release, not that the screen is broken.
          */}
          {isPending && releasable.length === 0 && links.length === 0 && (
            <section className="border border-dashed border-slate-200 rounded-2xl p-5 bg-white text-center">
              <Lock className="w-5 h-5 text-slate-300 mx-auto" aria-hidden="true" />
              <p className="mt-2 text-xs font-extrabold text-slate-500">{t('requests.notYours.title')}</p>
              <p className="mt-1 text-[11px] font-semibold text-slate-500 leading-relaxed">
                {t('requests.notYours.body')}
              </p>
            </section>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title={t(
          confirming === 'reject' ? 'requests.reject.confirm.title' : 'requests.approve.confirm.title',
          { name: applicantName }
        )}
        body={
          linkOnly
            ? t(confirming === 'reject' ? 'requests.link.reject.body' : 'requests.link.approve.body', {
                name: applicantName,
                children: linkNames,
              })
            : t(
                confirming === 'reject'
                  ? 'requests.reject.confirm.body'
                  : chosenClass
                    ? 'requests.approve.confirm.bodyClass'
                    : 'requests.approve.confirm.body',
                { name: applicantName, className: chosenClass?.name ?? '' }
              ) + (alongside.length > 0 ? ' ' + t('requests.decide.alongside', { roles: alongsideNames }) : '')
        }
        confirmLabel={t(confirming === 'reject' ? 'requests.reject' : 'requests.approve')}
        cancelLabel={t('common.cancel')}
        tone={confirming === 'approve' ? 'brand' : 'danger'}
        onCancel={() => setConfirming(null)}
        onConfirm={() => decide(confirming)}
      />
    </div>
  );
};

export default JoinRequestReview;
