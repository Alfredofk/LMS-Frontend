import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import SubdomainPanel from './SubdomainPanel';
import { useT } from '../../i18n/LanguageContext';
import { registrationLinkOf } from './adminSchools';

/*
  One School opened from the Platform Admin's list of every School (backend ed0d304;
  owner 2026-10-25: a short panel and its actions). In place of the list, as a
  registration's review is: the facts the list answers, the Governing Body above it
  or "Mandiri", whether it runs, and its address (`SubdomainPanel`, keyed by the
  school).

  Switching a School off and appointing its Principal are keyed by the registration
  on the server, so an independent School links to its registration's review
  ("Lihat pendaftaran", the queue opened on it); a Governing Body's School has no
  registration, and the panel says those two are not available for it yet.
*/

const Row = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">{label}</span>
    <span className="text-xs font-semibold text-slate-800 text-right break-words min-w-0">{children ?? '-'}</span>
  </div>
);

export const AdminSchoolDetail = ({ school, onBack, onChanged, showToast }) => {
  const { t, lang } = useT();
  const asDate = (value) => (value ? new Date(value).toLocaleDateString(lang === 'en' ? 'en-GB' : 'id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : null);
  const link = registrationLinkOf(school);
  const off = Boolean(school.deactivatedAt);

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

      <h2 className="text-xl font-extrabold text-slate-900 tracking-tight break-words">{school.name}</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm">
          <h3 className="text-sm font-extrabold text-slate-900 tracking-tight mb-2">{t('admin.section.school')}</h3>
          <Row label={t('admin.field.npsn')}>{school.npsn}</Row>
          <Row label={t('admin.field.schoolType')}>{school.schoolType}</Row>
          <Row label={t('admin.field.duration')}>{school.durationYears ? t('admin.field.duration.years', { n: school.durationYears }) : null}</Row>
          <Row label={t('admin.field.city')}>{school.city}</Row>
          <Row label={t('admin.field.timeZone')}>{school.timeZone}</Row>
          <Row label={t('adminSchools.field.body')}>{school.governingBody?.name ?? t('adminSchools.independent')}</Row>
          <Row label={t('adminSchools.field.created')}>{asDate(school.createdAt)}</Row>
          <Row label={t('admin.field.schoolState')}>
            <span className={off ? 'text-rose-600 font-extrabold' : 'text-emerald-600 font-extrabold'}>{t(off ? 'admin.school.off' : 'admin.school.on')}</span>
          </Row>
          {off && <Row label={t('adminSchools.field.offSince')}>{asDate(school.deactivatedAt)}</Row>}
          {off && school.deactivationReason && <Row label={t('adminSchools.field.offReason')}>{school.deactivationReason}</Row>}
        </section>

        <div className="space-y-6">
          <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">{t('adminSchools.manage.title')}</h3>
            {link ? (
              <>
                <p className="text-xs font-semibold text-slate-500 leading-relaxed">{t('adminSchools.manage.registration')}</p>
                <Link
                  to={link.pathname}
                  state={link.state}
                  className="inline-flex items-center px-4 py-2 text-sm rounded-xl font-bold border border-slate-300 hover:bg-slate-50 text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {t('adminSchools.manage.open')}
                </Link>
              </>
            ) : (
              <p className="text-xs font-semibold text-slate-500 leading-relaxed">{t('adminSchools.manage.body', { body: school.governingBody?.name ?? '' })}</p>
            )}
          </section>

          <SubdomainPanel key={school.id} school={school} showToast={showToast} onChanged={(subdomain) => onChanged?.({ id: school.id, subdomain })} />
        </div>
      </div>
    </div>
  );
};

export default AdminSchoolDetail;
