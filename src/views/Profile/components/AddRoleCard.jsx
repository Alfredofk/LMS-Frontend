import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { UserPlus } from 'lucide-react';

import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import AddRoleForm from '../../../components/AddRoleForm';
import { membershipService } from '../../../services/membershipService';
import { useAuth } from '../../../context/AuthContext';
import { useT } from '../../../i18n/LanguageContext';
import { cancelErrorMessage } from '../../../i18n/apiError';
import {
  ROLES,
  ROLE_LABEL_KEY,
  addsInstantly,
  rolesToAdd,
  cancellableRolesOf,
} from '../../../constants/roles';

/*
  Adding a role, and the roles already asked for — from the one screen every
  member can always reach.

  My Profile rather than /select-role, because sign-in goes straight to a
  dashboard (since 2026-09-24) and the picker is almost never passed through
  any more. That made this card the only place somebody could still see a role
  they had asked for: the picker's "still waiting · Cancel" line sat on a page
  they no longer visited. So a waiting TEACHER or GUARDIAN (`cancellableRolesOf`)
  is listed here too, with the same words and the same cancel.

  **It decides for itself whether it has anything to say**, like SchoolCodeCard
  beside it: nothing waiting and nothing to offer — a student, somebody holding
  every addable role, a school switched off — and it renders nothing. The
  statuses come from `/users/me`, which ProfilePage reads on arrival; sign-in's
  thin shape has none, so until that answer nothing waiting is shown.

  Offers are closed until asked for, one form open at a time.
*/

/* The pitch and the button per role; TEACHER's pitch depends on who asks. */
const COPY = {
  [ROLES.TEACHER]: (instant) => ({
    pitch: instant ? 'addRole.pitch.instant' : 'addRole.pitch.review',
    open: 'addRole.open',
    active: 'addRole.done.active',
    pending: 'addRole.done.pending',
  }),
  [ROLES.GUARDIAN]: () => ({
    pitch: 'addRole.guardian.pitch',
    open: 'addRole.guardian.open',
    active: 'addRole.guardian.done.active',
    pending: 'addRole.guardian.done.pending',
  }),
};

export const AddRoleCard = () => {
  const { membership, refreshMe } = useAuth();
  const { showToast } = useOutletContext();
  const { t } = useT();
  const [openRole, setOpenRole] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const offered = rolesToAdd(membership).filter((role) => COPY[role]);
  const waiting = cancellableRolesOf(membership);
  if (offered.length === 0 && waiting.length === 0) return null;

  const schoolName = membership?.school?.name ?? membership?.schoolName ?? '';
  const roleName = (role) => t(ROLE_LABEL_KEY[role]);

  const handleDone = (role) => ({ status, sessionUpdated }) => {
    setOpenRole(null);
    if (!sessionUpdated) {
      showToast(t('addRole.done.stale'), 'error');
      return;
    }
    const copy = COPY[role](addsInstantly(membership, role));
    showToast(t(status === 'ACTIVE' ? copy.active : copy.pending), 'success');
  };

  /* Either way the statuses are read again: a 404 or 409 means it was decided
     or withdrawn elsewhere, and the card should show what is true now. */
  const handleCancel = async () => {
    if (!cancelling) return;
    setIsCancelling(true);
    try {
      await membershipService.cancelRole(cancelling);
      showToast(t('selectRole.cancel.role.done', { role: roleName(cancelling) }), 'success');
    } catch (err) {
      showToast(cancelErrorMessage(err, t), 'error');
    } finally {
      await refreshMe().catch(() => {});
      setIsCancelling(false);
      setCancelling(null);
    }
  };

  return (
    <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 text-slate-500">
        <UserPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
        <h2 className="text-[11px] font-bold uppercase tracking-wider">{t('addRole.title')}</h2>
      </div>

      {waiting.length > 0 && (
        <ul className="space-y-2">
          {waiting.map((role) => (
            <li
              key={role}
              className="flex items-center justify-between gap-3 border border-amber-200 bg-amber-50 rounded-2xl px-4 py-3"
            >
              <p className="text-xs text-amber-800 font-semibold leading-relaxed min-w-0 break-words">
                {t('selectRole.cancel.role.waiting', { role: roleName(role) })}
              </p>
              <button
                type="button"
                onClick={() => setCancelling(role)}
                className="shrink-0 text-xs font-extrabold text-rose-600 hover:text-rose-700 underline underline-offset-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded"
              >
                {t('selectRole.cancel.role.action')}
              </button>
            </li>
          ))}
        </ul>
      )}

      {offered.map((role, index) => {
        const copy = COPY[role](addsInstantly(membership, role));
        const isOpen = openRole === role;
        const formId = `add-role-form-${role.toLowerCase()}`;
        return (
          <div
            key={role}
            className={`space-y-4 ${index > 0 || waiting.length > 0 ? 'pt-4 border-t border-slate-100' : ''}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
              <p className="text-sm font-semibold text-slate-700 leading-relaxed min-w-0">{t(copy.pitch)}</p>
              {!isOpen && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setOpenRole(role)}
                  aria-expanded={false}
                  aria-controls={formId}
                >
                  {t(copy.open)}
                </Button>
              )}
            </div>

            {isOpen && (
              <div id={formId} className="max-w-md">
                <AddRoleForm role={role} onDone={handleDone(role)} onCancel={() => setOpenRole(null)} />
              </div>
            )}
          </div>
        );
      })}

      <ConfirmDialog
        open={!!cancelling}
        title={cancelling ? t('selectRole.cancel.role.title', { role: roleName(cancelling) }) : ''}
        body={
          t('selectRole.cancel.role.body', { school: schoolName }) +
          (cancelling === ROLES.GUARDIAN ? ' ' + t('addRole.guardian.cancelLinks') : '')
        }
        confirmLabel={t('selectRole.cancel.confirm')}
        cancelLabel={t('selectRole.cancel.keep')}
        busy={isCancelling}
        busyLabel={t('common.loading')}
        onCancel={() => setCancelling(null)}
        onConfirm={handleCancel}
      />
    </section>
  );
};

export default AddRoleCard;
