import React, { useState } from 'react';
import { Power } from 'lucide-react';

import Button from '../../components/ui/Button';
import ReasonDialog from '../../components/ReasonDialog';
import { useT } from '../../i18n/LanguageContext';
import { isAmbiguousReactivation, isPlatformBrake, isStaleSchoolPower, schoolPowerErrorMessage } from '../../i18n/apiError';
import { governingBodyService } from '../../services/governingBodyService';
import { validateOptionalReason } from '../../utils/validation';
import { manageActionsOf, principalFateOf } from './schoolPowers';
import AppointPrincipalDialog from './AppointPrincipalDialog';
import ReleaseSchoolDialog from './ReleaseSchoolDialog';

/*
  "Kelola sekolah", at the foot of a School's summary (backend 261a9c7 / fdf0267, ticket
  08; owner 2026-10-26, E1-E8): what any admin changes in the School, each in a dialog
  that says what follows and asks a reason.

  - Angkat / Ganti Kepala Sekolah (AppointPrincipalDialog), from the teacher list read as
    it opens; Akhiri jabatan (a reason; the one sitting stays as a teacher or may leave).
  - Nonaktifkan sekolah (a reason) / Aktifkan kembali (a note or none). The row does not
    say who switched it off: a refusal for the Platform Admin's says so and hides the way
    back for the visit (`braked`) - also when it comes as the ambiguous "meanwhile" and
    the School, read again, is still off.
  - Lepaskan dari yayasan, while a Principal sits (ReleaseSchoolDialog, the name typed).

  A School changed meanwhile is a toast and a fresh read (`onChanged`); a 403 is the
  seat gone (`onGone`); released, the page goes back to the list (`onReleased`).
*/
export const SchoolManageCard = ({ school, showToast, onChanged, onGone, onReleased }) => {
  const { t } = useT();
  const [asking, setAsking] = useState(null);
  const [teachers, setTeachers] = useState(null);
  const [opening, setOpening] = useState(null);
  const [braked, setBraked] = useState(false);

  const actions = manageActionsOf(school, { braked });

  /* The teacher list is read as a dialog that needs it opens, so it is never stale. */
  const openWithTeachers = async (kind) => {
    setOpening(kind);
    try {
      const read = await governingBodyService.schoolTeachers(school.id);
      setTeachers(read?.teachers ?? []);
      setAsking(kind);
    } catch (err) {
      if (err?.status === 403) onGone();
      else showToast?.(schoolPowerErrorMessage(err, t), 'error');
    } finally {
      setOpening(null);
    }
  };

  /* Each call: done is a toast and a fresh read; changed meanwhile closes too; anything else stays in the dialog. */
  const run = (call, done) => async (...args) => {
    try {
      await call(...args);
    } catch (err) {
      if (err?.status === 403) {
        setAsking(null);
        onGone();
        return;
      }
      if (isPlatformBrake(err)) {
        setAsking(null);
        setBraked(true);
        showToast?.(t('gbpw.error.brake'), 'error');
        return;
      }
      /* The same refusal can come as the claim's "reactivated, or deactivated by the
         Platform Admin, meanwhile" (walked 2026-10-26): the School read again tells which. */
      if (isAmbiguousReactivation(err)) {
        setAsking(null);
        const now = await governingBodyService.school(school.id).catch(() => null);
        if (now?.deactivatedAt) {
          setBraked(true);
          showToast?.(t('gbpw.error.brake'), 'error');
        } else {
          showToast?.(t('gbpw.error.changed'), 'info');
        }
        onChanged();
        return;
      }
      if (isStaleSchoolPower(err)) {
        setAsking(null);
        showToast?.(schoolPowerErrorMessage(err, t), 'info');
        onChanged();
        return;
      }
      throw err;
    }
    setAsking(null);
    done();
  };

  const describe = (err) => schoolPowerErrorMessage(err, t);
  const fate = principalFateOf(school, teachers);

  return (
    <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-extrabold text-slate-900">{t('gbpw.title')}</h2>
        <p className="text-xs font-medium text-slate-500 mt-1">{t('gbpw.anyAdmin')}</p>
      </div>

      {actions.braked && <p className="text-xs font-semibold text-rose-700">{t('gbpw.error.brake')}</p>}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => openWithTeachers('appoint')} isLoading={opening === 'appoint'}>
          {t(actions.appoint === 'REPLACE' ? 'gbpw.appoint.actionReplace' : 'gbpw.appoint.action')}
        </Button>
        {actions.end && (
          <Button size="sm" variant="dangerOutline" onClick={() => openWithTeachers('end')} isLoading={opening === 'end'}>
            {t('gbpw.end.action')}
          </Button>
        )}
        {actions.deactivate && (
          <Button size="sm" variant="dangerOutline" onClick={() => setAsking('deactivate')}>
            {t('gbpw.deactivate.action')}
          </Button>
        )}
        {actions.reactivate && (
          <Button size="sm" variant="outline" onClick={() => setAsking('reactivate')}>
            {t('gbpw.reactivate.action')}
          </Button>
        )}
        {actions.release && (
          <Button size="sm" variant="dangerOutline" onClick={() => setAsking('release')}>
            {t('gbpw.release.action')}
          </Button>
        )}
      </div>

      {asking === 'appoint' && (
        <AppointPrincipalDialog
          key={`appoint:${school.id}`}
          school={school}
          teachers={teachers}
          onClose={() => setAsking(null)}
          describeError={describe}
          onSubmit={run(
            async (membershipId, reason) => {
              const answer = await governingBodyService.appointPrincipal(school.id, membershipId, reason);
              showToast?.(t('gbpw.appoint.done', { name: answer?.principal?.fullName ?? '', school: school.name }), 'success');
            },
            onChanged
          )}
        />
      )}

      {asking === 'end' && (
        <ReasonDialog
          key={`end:${school.id}`}
          title={t('gbpw.end.title', { school: school.name })}
          body={
            <>
              {fate && <p>{t(fate.fate === 'STAYS' ? 'gbpw.fate.stays' : 'gbpw.fate.mayLeave', { name: fate.name })}</p>}
              <p className="mt-1.5">{t('gbpw.end.body')}</p>
            </>
          }
          label={t('gba.reason')}
          hint={t('gbpw.reason.hint')}
          confirmLabel={t('gbpw.end.confirm')}
          onClose={() => setAsking(null)}
          describeError={describe}
          onSubmit={run(
            async (reason) => {
              await governingBodyService.endPrincipal(school.id, reason);
              showToast?.(t('gbpw.end.done', { school: school.name }), 'success');
            },
            onChanged
          )}
        />
      )}

      {asking === 'deactivate' && (
        <ReasonDialog
          key={`off:${school.id}`}
          title={t('gbpw.deactivate.title', { school: school.name })}
          body={t('gbpw.deactivate.body')}
          label={t('gba.reason')}
          hint={t('gbpw.reason.hint')}
          confirmLabel={t('gbpw.deactivate.confirm')}
          onClose={() => setAsking(null)}
          describeError={describe}
          onSubmit={run(
            async (reason) => {
              await governingBodyService.deactivateSchool(school.id, reason);
              showToast?.(t('gbpw.deactivate.done', { school: school.name }), 'success');
            },
            onChanged
          )}
        />
      )}

      {asking === 'reactivate' && (
        <ReasonDialog
          key={`on:${school.id}`}
          tone="brand"
          icon={Power}
          title={t('gbpw.reactivate.title', { school: school.name })}
          body={t('gbpw.reactivate.body')}
          label={t('gbpw.reactivate.note')}
          hint={t('gbpw.reactivate.hint')}
          confirmLabel={t('gbpw.reactivate.confirm')}
          validate={validateOptionalReason}
          onClose={() => setAsking(null)}
          describeError={describe}
          onSubmit={run(
            async (note) => {
              await governingBodyService.reactivateSchool(school.id, note);
              showToast?.(t('gbpw.reactivate.done', { school: school.name }), 'success');
            },
            onChanged
          )}
        />
      )}

      {asking === 'release' && (
        <ReleaseSchoolDialog
          schoolName={school.name}
          onClose={() => setAsking(null)}
          describeError={describe}
          onSubmit={run(
            async (reason) => {
              await governingBodyService.releaseSchool(school.id, reason);
              showToast?.(t('gbpw.release.done', { school: school.name }), 'success');
            },
            onReleased
          )}
        />
      )}
    </section>
  );
};

export default SchoolManageCard;
