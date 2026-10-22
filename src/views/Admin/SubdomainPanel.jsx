import React, { useState } from 'react';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { adminService } from '../../services/adminService';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import { schoolAddressOf, subdomainLabelError } from '../../constants/subdomain';

/*
  A school's own address, for the Platform Admin (backend a577abd; owner 2026-10-22
  E4), on an approved registration's review beside the appoint-principal panel. The
  label is given at approval by the backend's rule and never follows a rename; only
  the admin changes it (`PATCH /admin/schools/:id/subdomain`, keyed by the school),
  audited, and the old address stops opening at once - the question says so. The
  label is checked as the server checks it (a DNS label, not a reserved word, not
  the one it has); a label another school holds is the server's to say.
*/

const SUBDOMAIN_BY_MESSAGE = [
  ['is reserved for the platform', 'subdomain.error.reserved'],
  ['already uses', 'subdomain.error.same'],
  ['is taken by another school', 'subdomain.error.taken'],
  ['changed meanwhile', 'subdomain.error.meanwhile'],
  ['Use 1 to 63 lowercase letters', 'subdomain.error.pattern'],
  ['School not found', 'subdomain.error.gone'],
];

const SubdomainPanel = ({ registration, showToast }) => {
  const { t } = useT();
  const school = registration.school;
  const [current, setCurrent] = useState(school?.subdomain ?? null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [isSending, setIsSending] = useState(false);

  if (!school?.id) return null;
  const address = schoolAddressOf(current);
  const label = value.trim().toLowerCase();

  const submit = (e) => {
    e.preventDefault();
    const fail = subdomainLabelError(value, current);
    setError(fail ? t(fail) : null);
    if (!fail) setConfirming(true);
  };

  const change = async () => {
    setIsSending(true);
    try {
      const answer = await adminService.changeSubdomain(school.id, label);
      setCurrent(answer?.school?.subdomain ?? label);
      setEditing(false);
      setValue('');
      setError(null);
      showToast?.(t('subdomain.done', { school: registration.schoolName, label: answer?.school?.subdomain ?? label }), 'success');
    } catch (err) {
      const said = [String(err?.message ?? ''), ...(Array.isArray(err?.details) ? err.details.map((issue) => String(issue?.message ?? '')) : [])];
      const hit = SUBDOMAIN_BY_MESSAGE.find(([needle]) => said.some((text) => text.includes(needle)));
      setError(hit ? t(hit[1]) : apiErrorMessage(err, t));
    } finally {
      setConfirming(false);
      setIsSending(false);
    }
  };

  return (
    <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm space-y-4">
      <div className="min-w-0">
        <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">{t('subdomain.section')}</h3>
        <p className="text-xs font-semibold text-slate-500 mt-1 leading-relaxed">{t('subdomain.lead')}</p>
      </div>

      <dl className="text-sm">
        <dt className="text-[11px] font-semibold text-slate-500">{t('subdomain.current')}</dt>
        <dd className="font-bold text-slate-900 break-all">
          {current ?? '-'}
          {address && <span className="block text-xs font-semibold text-slate-500">{address}</span>}
        </dd>
      </dl>

      {editing ? (
        <form onSubmit={submit} className="space-y-3" noValidate>
          <Input
            id="schoolSubdomain"
            name="subdomain"
            label={t('subdomain.new')}
            autoComplete="off"
            value={value}
            error={error || undefined}
            onChange={(e) => {
              setValue(e.target.value.toLowerCase());
              setError(null);
            }}
          />
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{t('subdomain.hint')}</p>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditing(false);
                setValue('');
                setError(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={isSending}>
              {t('subdomain.save')}
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" onClick={() => setEditing(true)} className="w-full justify-center">
          {t('subdomain.edit')}
        </Button>
      )}

      <ConfirmDialog
        open={confirming}
        tone="danger"
        title={t('subdomain.confirm.title', { school: registration.schoolName })}
        body={t('subdomain.confirm.body', { from: current ?? '', to: label })}
        confirmLabel={t('subdomain.save')}
        cancelLabel={t('common.cancel')}
        busy={isSending}
        busyLabel={t('common.loading')}
        onConfirm={change}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
};

export default SubdomainPanel;
