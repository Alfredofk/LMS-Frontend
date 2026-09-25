import React, { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Info, Plus, Users } from 'lucide-react';

import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import ChildFields from '../../components/ChildFields';
import { membershipService } from '../../services/membershipService';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { guardianErrorMessage } from '../../i18n/apiError';
import { childErrors, childPayload, nestedFieldErrors } from '../../utils/validation';

/*
  "Anak Saya" — the guardian's home, /guardian.

  Everything the backend tells a guardian today is on this page: `/users/me`
  `children[]`, each `{ id, status, relationship, rejectionReason, student:
  { fullName } }`. No grades, no attendance, no timetable — there is no endpoint
  for any of those, for a guardian or anybody else — so the page says so once,
  instead of borrowing the student dashboard's sample numbers. The owner chose
  that (2026-09-24).

  ## What can be done here

  - **Claim another child** — `POST /memberships/me/children`, the same three
    fields as the first claim (ChildFields). ACTIVE at once when the guardian is
    the child's own homeroom teacher; otherwise it waits for that teacher on
    /join-requests. The answer says which; nothing here guesses.
  - **Take back a claim still waiting** — `POST /me/children/:id/cancel`.

  The first child came with the GUARDIAN role itself; while that role waits, this
  page is not reachable (ProtectedRoute), and taking it back is the role's
  cancel on /select-role, which withdraws the link with it.

  ## Why it reads /users/me itself

  Sign-in answers the thin membership, with no `children` at all — the same
  reason ProfilePage and ClassesPage read it once on mount, through a ref.
*/

const STATUS_BADGE = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  PENDING: 'bg-amber-50 text-amber-700',
  REJECTED: 'bg-rose-50 text-rose-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

const OWNED_FIELDS = ['childNisn', 'childFullName', 'relationship'];
const EMPTY = { childNisn: '', childFullName: '', relationship: '' };

export const GuardianPage = () => {
  const { showToast } = useOutletContext();
  const { membership, refreshMe } = useAuth();
  const { t } = useT();

  const asked = useRef(false);
  const [loadError, setLoadError] = useState(null);

  const [isAdding, setIsAdding] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [isWorking, setIsWorking] = useState(false);

  const [cancelling, setCancelling] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    refreshMe().catch((err) => setLoadError(guardianErrorMessage(err, t)));
  }, [refreshMe, t]);

  /* The sign-in shape has no children array; until /users/me answers, loading. */
  const children = Array.isArray(membership?.children) ? membership.children : null;
  const schoolName = membership?.school?.name ?? membership?.schoolName ?? '';

  const change = (name) => (e) => {
    const { value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name] || errors.global) setErrors((prev) => ({ ...prev, [name]: null, global: null }));
  };

  const closeForm = () => {
    setIsAdding(false);
    setValues(EMPTY);
    setErrors({});
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (isWorking) return;

    const next = {};
    for (const [name, fail] of Object.entries(childErrors(values))) next[name] = t(fail.key, fail.vars);
    setErrors(next);
    if (Object.keys(next).length) return;

    setIsWorking(true);
    try {
      const link = await membershipService.linkChild(childPayload(values));
      await refreshMe().catch(() => {});
      closeForm();
      showToast(
        t(link?.status === 'ACTIVE' ? 'guardian.add.done.active' : 'guardian.add.done.pending', {
          name: link?.student?.fullName ?? values.childFullName.trim(),
        }),
        'success'
      );
    } catch (err) {
      const fieldErrors = nestedFieldErrors(err.details, OWNED_FIELDS);
      setErrors(Object.keys(fieldErrors).length ? fieldErrors : { global: guardianErrorMessage(err, t) });
    } finally {
      setIsWorking(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelling) return;
    setIsCancelling(true);
    try {
      await membershipService.cancelLink(cancelling.id);
      showToast(t('guardian.cancel.done', { name: cancelling.student?.fullName ?? '' }), 'success');
    } catch (err) {
      showToast(guardianErrorMessage(err, t), 'error');
    } finally {
      /* Either way, show what is true now: a 404 means it was decided meanwhile. */
      await refreshMe().catch(() => {});
      setIsCancelling(false);
      setCancelling(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="select-none">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('guardian.title')}</h1>
        <p className="text-xs sm:text-sm text-slate-500 font-bold mt-1">
          {schoolName ? t('guardian.subtitle', { school: schoolName }) : ''}
        </p>
      </div>

      <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-500">
            <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
            <h2 className="text-[11px] font-bold uppercase tracking-wider">{t('guardian.list.heading')}</h2>
          </div>
          {!isAdding && children !== null && (
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => setIsAdding(true)}>
              <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
              {t('guardian.add.open')}
            </Button>
          )}
        </div>

        {isAdding && (
          <form
            onSubmit={handleAdd}
            noValidate
            className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-4 max-w-xl text-left"
          >
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">{t('guardian.add.hint')}</p>
            <ChildFields values={values} errors={errors} onChange={change} idPrefix="guardian" />
            {errors.global && (
              <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
                {errors.global}
              </div>
            )}
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{t('guardian.add.after')}</p>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={closeForm} isDisabled={isWorking}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" isLoading={isWorking}>
                {t('guardian.add.submit')}
              </Button>
            </div>
          </form>
        )}

        {loadError && children === null ? (
          <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
            {loadError}
          </div>
        ) : children === null ? (
          <div className="h-24 bg-slate-50 rounded-2xl animate-pulse" aria-label={t('common.loading')} />
        ) : children.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-slate-200 rounded-2xl select-none">
            <Users className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
            <p className="mt-2 text-xs font-extrabold text-slate-500">{t('guardian.list.empty')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {children.map((link) => (
              <li key={link.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-extrabold break-words ${link.status === 'CANCELLED' ? 'text-slate-500' : 'text-slate-800'}`}>
                      {link.student?.fullName}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[link.status] ?? STATUS_BADGE.CANCELLED}`}>
                      {t(`guardian.status.${link.status}`)}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500">
                    {t('guardian.list.relationship', { relationship: link.relationship })}
                  </p>
                  {/* The homeroom teacher's own words, marked as a quotation. */}
                  {link.status === 'REJECTED' && link.rejectionReason && (
                    <p className="pl-2 border-l-2 border-rose-200 text-[11px] text-rose-700 font-semibold break-words">
                      {link.rejectionReason}
                    </p>
                  )}
                  {link.status === 'PENDING' && (
                    <p className="text-[11px] font-semibold text-slate-500">{t('guardian.list.pendingHint')}</p>
                  )}
                </div>
                {link.status === 'PENDING' && (
                  <button
                    type="button"
                    onClick={() => setCancelling(link)}
                    className="self-start sm:self-auto shrink-0 text-xs font-extrabold text-rose-600 hover:text-rose-700 underline underline-offset-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded"
                  >
                    {t('guardian.cancel.action')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Said once, plainly, instead of a dashboard of invented numbers. */}
      <p className="flex items-start gap-2 text-xs font-semibold text-slate-500 leading-relaxed">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" aria-hidden="true" />
        {t('guardian.notYet')}
      </p>

      <ConfirmDialog
        open={!!cancelling}
        title={t('guardian.cancel.title', { name: cancelling?.student?.fullName ?? '' })}
        body={t('guardian.cancel.body')}
        confirmLabel={t('selectRole.cancel.confirm')}
        cancelLabel={t('selectRole.cancel.keep')}
        busy={isCancelling}
        busyLabel={t('common.loading')}
        onCancel={() => setCancelling(null)}
        onConfirm={handleCancel}
      />
    </div>
  );
};

export default GuardianPage;
