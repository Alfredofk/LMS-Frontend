import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { useAuth } from '../../../context/AuthContext';
import { useT } from '../../../i18n/LanguageContext';
import { cancelErrorMessage, placesErrorMessage } from '../../../i18n/apiError';
import { membershipService } from '../../../services/membershipService';
import { schoolService } from '../../../services/schoolService';
import GoverningBodyRegistrationLine from '../../../components/GoverningBodyRegistrationLine';
import { hasGoverningBody, mayJoinAnother, openPlaceOf, otherPlacesOf, otherSchoolRows, placeRoleKeysOf, samePlace } from '../../../constants/places';

/*
  "Sekolah lain" on My Profile (owner, 2026-10-22; backend 72e546b): everything about
  this person's schools other than the one open now.
  - The other schools they may open, each with "Buka" - the avatar menu's switch:
    the sign-in is traded for that school's and the app loads afresh there.
  - Their state at every school they may not open (`otherSchools`): a request
    waiting (with "Batalkan", by its id), turned down (the reviewer's words),
    cancelled, ended (its reason), or a school switched off. A school registration
    still under review or turned down is listed too.
  - For anybody who is not a student anywhere: "Gabung sebagai guru", "Gabung sebagai
    wali murid" (the join form, School Code first, `?another=1`) and "Daftarkan
    sekolah baru" (the registration form). A student belongs to one school only.
  Nothing to say and nothing to offer: no card.

  A Governing Body seat (backend b5cfffd) is one of the places to open, "Admin
  yayasan" under its name, and while one is listed the card is "Sekolah atau yayasan
  lain" (owner, 2026-10-24).
*/

const STATE_TONE = {
  WAITING: 'text-amber-700',
  REJECTED: 'text-rose-700',
  CANCELLED: 'text-slate-500',
  ENDED: 'text-slate-500',
  SWITCHED_OFF: 'text-slate-500',
};

export const OtherSchoolsCard = () => {
  const { membership, governingBody, places, otherSchools, refreshMe, openPlace } = useAuth();
  const { showToast } = useOutletContext() ?? {};
  const navigate = useNavigate();
  const { t } = useT();

  const asked = useRef(false);
  const [registrations, setRegistrations] = useState([]);
  const [opening, setOpening] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    refreshMe().catch(() => {});
    schoolService
      .listMyRegistrations()
      .then((answer) => setRegistrations(answer?.registrations ?? []))
      .catch(() => {});
  }, [refreshMe]);

  const others = otherPlacesOf(places, openPlaceOf({ membership, governingBody }));
  const withBody = hasGoverningBody(others);
  const rows = otherSchoolRows(otherSchools);
  /* The newest registration (the list is newest first), while under review or turned
     down; an approved one is a place now, and an older refusal is history. */
  const latest = registrations[0] ?? null;
  const registration = latest && (latest.status === 'PENDING' || latest.status === 'REJECTED') ? latest : null;
  const canJoin = mayJoinAnother(membership, otherSchools);
  if (others.length === 0 && rows.length === 0 && !registration && !canJoin) return null;

  const open = async (place) => {
    setOpening(place);
    try {
      await openPlace(place);
    } catch (err) {
      showToast?.(placesErrorMessage(err, t, place), 'error');
      setOpening(null);
      refreshMe().catch(() => {});
    }
  };

  const cancel = async () => {
    if (!cancelling) return;
    setBusy(true);
    try {
      await membershipService.cancelJoinRequest(cancelling.id);
      showToast?.(t('others.cancelled', { school: cancelling.schoolName }), 'success');
    } catch (err) {
      showToast?.(cancelErrorMessage(err, t), 'error');
    } finally {
      await refreshMe().catch(() => {});
      setBusy(false);
      setCancelling(null);
    }
  };

  const roleWords = (roles) => roles.map((role) => t(`roleTitle.${role}`)).join(', ');

  return (
    <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-extrabold text-slate-900">{t(withBody ? 'others.title.withBody' : 'others.title')}</h2>
        <p className="text-xs font-medium text-slate-500 leading-relaxed mt-0.5">{t(withBody ? 'others.body.withBody' : 'others.body')}</p>
      </div>

      {(others.length > 0 || rows.length > 0 || registration) && (
        <ul className="divide-y divide-slate-100">
          {others.map((place) => (
            <li key={`${place.kind}:${place.id}`} className="py-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 break-words">{place.name}</p>
                <p className="text-xs font-semibold text-slate-500">{placeRoleKeysOf(place).map((key) => t(key)).join(', ')}</p>
              </div>
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => open(place)} isLoading={samePlace(opening, place)} isDisabled={Boolean(opening)}>
                {t('others.open')}
              </Button>
            </li>
          ))}
          {rows.map((row) => (
            <li key={row.id} className="py-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 break-words">{row.schoolName}</p>
                <p className={`text-xs font-semibold ${STATE_TONE[row.state]}`}>
                  {t(`others.state.${row.state}`, { roles: roleWords(row.roles) })}
                </p>
                {row.reason && <p className="text-xs text-slate-600 break-words mt-0.5">{t('others.reason', { reason: row.reason })}</p>}
              </div>
              {row.state === 'WAITING' && (
                <button
                  type="button"
                  onClick={() => setCancelling(row)}
                  className="self-start sm:self-auto shrink-0 text-xs font-extrabold text-rose-600 hover:text-rose-700 underline underline-offset-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded"
                >
                  {t('others.cancel')}
                </button>
              )}
            </li>
          ))}
          {registration && (
            <li className="py-3 first:pt-0">
              <p className="text-sm font-bold text-slate-900 break-words">{registration.schoolName}</p>
              <p className={`text-xs font-semibold ${registration.status === 'PENDING' ? 'text-amber-700' : 'text-rose-700'}`}>
                {t(registration.status === 'PENDING' ? 'others.registration.pending' : 'others.registration.rejected')}
              </p>
              {registration.status === 'REJECTED' && registration.rejectionReason && (
                <p className="text-xs text-slate-600 break-words mt-0.5">{t('others.reason', { reason: registration.rejectionReason })}</p>
              )}
            </li>
          )}
        </ul>
      )}

      {canJoin && (
        <div className={`flex flex-col sm:flex-row sm:flex-wrap gap-2 ${others.length > 0 || rows.length > 0 || registration ? 'pt-4 border-t border-slate-100' : ''}`}>
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => navigate('/get-started/teacher?another=1')}>
            {t('others.join.teacher')}
          </Button>
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => navigate('/get-started/guardian?another=1')}>
            {t('others.join.guardian')}
          </Button>
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => navigate('/get-started/organization')}>
            {t('others.register')}
          </Button>
        </div>
      )}

      {/* Registering a Governing Body (backend b5cfffd; owner 2026-10-24): one line, its state in its place. */}
      {canJoin && <GoverningBodyRegistrationLine />}

      <ConfirmDialog
        open={Boolean(cancelling)}
        tone="danger"
        title={t('others.cancelTitle')}
        body={cancelling ? t('others.cancelBody', { school: cancelling.schoolName }) : ''}
        confirmLabel={t('selectRole.cancel.confirm')}
        cancelLabel={t('selectRole.cancel.keep')}
        busy={busy}
        busyLabel={t('common.loading')}
        onCancel={() => setCancelling(null)}
        onConfirm={cancel}
      />
    </section>
  );
};

export default OtherSchoolsCard;
