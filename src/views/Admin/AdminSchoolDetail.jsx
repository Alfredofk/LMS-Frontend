import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Lock, Power } from 'lucide-react';

import Button from '../../components/ui/Button';
import ReasonDialog from '../../components/ReasonDialog';
import SubdomainPanel from './SubdomainPanel';
import AppointPrincipalPanel from './AppointPrincipalPanel';
import SchoolApplicationsTab from '../GoverningBody/SchoolApplicationsTab';
import { adminService } from '../../services/adminService';
import { useT } from '../../i18n/LanguageContext';
import { adminSchoolErrorMessage } from '../../i18n/apiError';
import { validateOptionalReason } from '../../utils/validation';
import { adminActionsOf, registrationLinkOf } from './adminSchools';
import { Fact, Facts, SlashFacts } from './adminParts';

/*
  One School opened from the Platform Admin's list of every School (backend ed0d304;
  owner 2026-10-25: a short panel and its actions; 2026-10-26, G1-G6). In place of the
  list, as a registration's review is: the facts the list answers, the Governing Body
  above it or "Mandiri", whether it runs. Beside them:

  - "Kelola sekolah", by the School's own id for any School (backend 38ec9ce / fdf0267):
    Nonaktifkan (a reason) or Aktifkan kembali (a note or none), and for a body's School
    switched off by the body "Kunci penonaktifan" - the body's deactivation taken over,
    so the body cannot switch it on. The row says whose it is (`deactivatedByPlatform`,
    backend 227473f); a refusal "already deactivated" met anyway hides the button for the
    visit. An independent School keeps "Lihat pendaftaran", its registration's review.
  - Its Principal by an active teacher's email (`AppointPrincipalPanel` given `school`);
    at a body's School only while the body is switched off (`governingBody.deactivatedAt`,
    227473f): while it runs, one note stands in place of the panel and the applications,
    and nothing is read (owner 2026-10-26, E).
  - Its address (`SubdomainPanel`) and its history under bodies (`GET .../affiliations`).
  - For a body's School, full width below, its Principal applications as the body's
    admins read them (`SchoolApplicationsTab` with the Platform Admin's calls, ticket
    06c), only while the body is switched off.
*/

const ADMIN_SOURCE = {
  list: (schoolId, status) => adminService.schoolPrincipalApplications(schoolId, status),
  ktp: (schoolId, applicationId) => adminService.schoolPrincipalKtp(schoolId, applicationId),
  approve: (schoolId, applicationId) => adminService.approveSchoolPrincipal(schoolId, applicationId),
  reject: (schoolId, applicationId, reason) => adminService.rejectSchoolPrincipal(schoolId, applicationId, reason),
};

const noop = () => {};

/* The look since 2026-10-28 (owner, mockup daftar-sekolah.html): a slash line under the
   name (whether it runs, its body or "Mandiri", since when it is off), the facts as eyebrow
   cells, the dashboards' card frame, a history entry as the body's name over one grey line. */

/* The bodies a School has been under, the latest first. */
const AffiliationHistory = ({ schoolId, version }) => {
  const { t, lang } = useT();
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);
  const asDate = (value) => (value ? new Date(value).toLocaleDateString(lang === 'en' ? 'en-GB' : 'id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

  useEffect(() => {
    let cancelled = false;
    adminService
      .schoolAffiliations(schoolId)
      .then((read) => {
        if (cancelled) return;
        setRows(read);
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [schoolId, version]);

  return (
    <section className="bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm min-w-0 space-y-3">
      <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{t('adminSchools.history.title')}</h3>
      {failed ? (
        <p className="text-xs font-semibold text-rose-700">{t('adminSchools.history.failed')}</p>
      ) : rows === null ? (
        <div className="h-12 bg-slate-50 rounded-xl animate-pulse" aria-label={t('common.loading')} />
      ) : rows.length === 0 ? (
        <p className="text-xs font-semibold text-slate-500">{t('adminSchools.history.none')}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.id} className="py-2.5 space-y-0.5">
              <p className="text-sm font-bold text-slate-900 break-words">{row.governingBody?.name ?? '-'}</p>
              <SlashFacts
                parts={[
                  t(row.began === 'JOINED' ? 'adminSchools.history.began.JOINED' : 'adminSchools.history.began.CREATED'),
                  t('adminSchools.history.sinceOn', { date: asDate(row.startedAt) }),
                  row.startedBy?.fullName,
                  row.endedAt ? (
                    t('adminSchools.history.endedOn', { date: asDate(row.endedAt) })
                  ) : (
                    <span className="font-bold text-emerald-700">{t('adminSchools.history.nowWord')}</span>
                  ),
                  row.endedAt && row.endedBy?.fullName,
                ]}
              />
              {row.endedAt && row.endReason && <p className="text-xs font-medium text-slate-600 break-words">{t('others.reason', { reason: row.endReason })}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export const AdminSchoolDetail = ({ school, onBack, onChanged, showToast }) => {
  const { t, lang } = useT();
  const asDate = (value) => (value ? new Date(value).toLocaleDateString(lang === 'en' ? 'en-GB' : 'id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : null);
  const link = registrationLinkOf(school);
  const off = Boolean(school.deactivatedAt);
  const [asking, setAsking] = useState(null);
  const [locked, setLocked] = useState(false);
  const [version, setVersion] = useState(0);
  const actions = adminActionsOf(school, { locked });

  /* A change answers the School's row: merged into the list; a refusal stays in the dialog, but "already deactivated" while locking means it is locked. */
  const run = (call, doneKey) => async (reason) => {
    let answer;
    try {
      answer = await call(school.id, reason);
    } catch (err) {
      if (asking === 'lock' && String(err?.message ?? '').includes('already deactivated')) {
        setAsking(null);
        setLocked(true);
        showToast?.(t('adminSchools.lock.already'), 'info');
        return;
      }
      throw err;
    }
    if (asking === 'lock') setLocked(true);
    setAsking(null);
    if (answer?.school) onChanged?.(answer.school);
    setVersion((n) => n + 1);
    showToast?.(t(doneKey, { school: school.name }), 'success');
  };

  const describe = (err) => adminSchoolErrorMessage(err, t);

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-500 hover:text-brand transition-colors cursor-pointer focus:outline-none focus-visible:text-brand"
      >
        <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
        {t('adminSchools.back')}
      </button>

      <div className="min-w-0">
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight break-words">{school.name}</h2>
        <SlashFacts
          className="block mt-1.5 text-sm font-medium text-slate-500"
          parts={[
            <span className={`font-bold ${off ? 'text-rose-700' : 'text-emerald-700'}`}>{t(off ? 'admin.school.off' : 'admin.school.on')}</span>,
            school.governingBody?.name ?? t('adminSchools.independent'),
            off && t('adminSchools.offSinceLine', { date: asDate(school.deactivatedAt) }),
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          <section className="bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm min-w-0">
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{t('admin.section.school')}</h3>
            <Facts>
              <Fact label={t('admin.field.npsn')}>{school.npsn}</Fact>
              <Fact label={t('admin.field.schoolType')}>{school.schoolType}</Fact>
              <Fact label={t('admin.field.duration')}>{school.durationYears ? t('admin.field.duration.years', { n: school.durationYears }) : null}</Fact>
              <Fact label={t('admin.field.city')}>{school.city}</Fact>
              <Fact label={t('admin.field.timeZone')}>{school.timeZone}</Fact>
              <Fact label={t('adminSchools.field.created')}>{asDate(school.createdAt)}</Fact>
              {off && school.deactivationReason && (
                <Fact label={t('adminSchools.field.offReason')} wide>
                  {school.deactivationReason}
                </Fact>
              )}
            </Facts>
          </section>

          {actions.appoint ? (
            <AppointPrincipalPanel
              key={`appoint:${school.id}`}
              school={school}
              note={actions.governed ? t('adminSchools.appoint.bodyNote', { body: school.governingBody.name }) : null}
              onAppointed={(row) => {
                if (row) onChanged?.(row);
                setVersion((n) => n + 1);
              }}
              showToast={showToast}
            />
          ) : (
            <section className="bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm min-w-0 space-y-1">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{t('admin.appoint.section')}</h3>
              <p className="text-xs font-semibold text-slate-500 leading-relaxed break-words">{t('adminSchools.bodyRuns', { body: school.governingBody.name })}</p>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm min-w-0 space-y-3">
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{t('adminSchools.manage.title')}</h3>
            <div className="flex flex-wrap gap-2">
              {actions.deactivate && (
                <Button size="sm" variant="dangerOutline" onClick={() => setAsking('deactivate')}>
                  {t('adminSchools.deactivate.action')}
                </Button>
              )}
              {actions.reactivate && (
                <Button size="sm" variant="outline" onClick={() => setAsking('reactivate')}>
                  {t('adminSchools.reactivate.action')}
                </Button>
              )}
              {actions.lock && (
                <Button size="sm" variant="dangerOutline" onClick={() => setAsking('lock')}>
                  {t('adminSchools.lock.action')}
                </Button>
              )}
            </div>
            {actions.lock && <p className="text-xs font-semibold text-slate-500 leading-relaxed">{t('adminSchools.lock.hint', { body: school.governingBody.name })}</p>}
            {link && (
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <p className="text-xs font-semibold text-slate-500 leading-relaxed">{t('adminSchools.manage.registration')}</p>
                <Link
                  to={link.pathname}
                  state={link.state}
                  className="inline-flex items-center px-4 py-2 text-sm rounded-xl font-bold border border-slate-300 hover:bg-slate-50 text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {t('adminSchools.manage.open')}
                </Link>
              </div>
            )}
          </section>

          <SubdomainPanel key={school.id} school={school} showToast={showToast} onChanged={(subdomain) => onChanged?.({ id: school.id, subdomain })} />

          <AffiliationHistory schoolId={school.id} version={version} />
        </div>
      </div>

      {actions.applications && (
        <SchoolApplicationsTab
          key={`apps:${school.id}`}
          school={school}
          version={version}
          source={ADMIN_SOURCE}
          lead={t('adminSchools.applications.lead', { body: school.governingBody.name })}
          showToast={showToast}
          onChanged={() => setVersion((n) => n + 1)}
          onGone={noop}
        />
      )}

      {asking === 'deactivate' && (
        <ReasonDialog
          key={`off:${school.id}`}
          title={t('adminSchools.deactivate.title', { school: school.name })}
          body={t('adminSchools.deactivate.body')}
          label={t('gba.reason')}
          hint={t('gbpw.reason.hint')}
          confirmLabel={t('adminSchools.deactivate.confirm')}
          onClose={() => setAsking(null)}
          describeError={describe}
          onSubmit={run(adminService.deactivateSchool, 'adminSchools.deactivate.done')}
        />
      )}

      {asking === 'lock' && (
        <ReasonDialog
          key={`lock:${school.id}`}
          icon={Lock}
          title={t('adminSchools.lock.title', { school: school.name })}
          body={t('adminSchools.lock.body', { body: school.governingBody?.name ?? '' })}
          label={t('gba.reason')}
          hint={t('gbpw.reason.hint')}
          confirmLabel={t('adminSchools.lock.confirm')}
          onClose={() => setAsking(null)}
          describeError={describe}
          onSubmit={run(adminService.deactivateSchool, 'adminSchools.lock.done')}
        />
      )}

      {asking === 'reactivate' && (
        <ReasonDialog
          key={`on:${school.id}`}
          tone="brand"
          icon={Power}
          title={t('adminSchools.reactivate.title', { school: school.name })}
          body={t('gbpw.reactivate.body')}
          label={t('gbpw.reactivate.note')}
          hint={t('gbpw.reactivate.hint')}
          confirmLabel={t('adminSchools.reactivate.action')}
          validate={validateOptionalReason}
          onClose={() => setAsking(null)}
          describeError={describe}
          onSubmit={run(adminService.reactivateSchool, 'adminSchools.reactivate.done')}
        />
      )}
    </div>
  );
};

export default AdminSchoolDetail;
