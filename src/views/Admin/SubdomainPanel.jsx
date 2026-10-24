import React, { useState } from 'react';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { adminService } from '../../services/adminService';
import { adminGoverningBodyService } from '../../services/adminGoverningBodyService';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import { schoolAddressOf, subdomainLabelError } from '../../constants/subdomain';

/*
  A place's own address, for the Platform Admin: a school's (backend a577abd; owner
  2026-10-22 E4), on an approved registration's review beside the appoint-principal
  panel, or a Governing Body's (backend 3d7d05a; owner 2026-10-24), on its approved
  registration's review under the correction - `body` given instead. The label is
  given at approval by the backend's rule and never follows a rename; only the admin
  changes it (`PATCH /admin/schools/:id/subdomain` or `/admin/governing-bodies/:id/
  subdomain`, keyed by the place), audited, and the old address stops opening at
  once - the question says so. Schools and bodies share one space of labels. The
  label is checked as the server checks it (a DNS label, not a reserved word, not
  the one it has); a label another place holds is the server's to say.

  `onChanged(subdomain)` hands the new label up, for a body whose view shows it.
*/

/* [the server's words, the school's key, the body's key where its words differ] */
const SUBDOMAIN_BY_MESSAGE = [
  ['is reserved for the platform', 'subdomain.error.reserved'],
  ['already uses', 'subdomain.error.same', 'subdomain.error.same.body'],
  ['is taken by another', 'subdomain.error.taken'],
  ['changed meanwhile', 'subdomain.error.meanwhile', 'subdomain.error.meanwhile.body'],
  ['Use 1 to 63 lowercase letters', 'subdomain.error.pattern'],
  ['School not found', 'subdomain.error.gone'],
  ['Governing body not found', 'subdomain.error.gone.body'],
];

const SubdomainPanel = ({ registration, body, showToast, onChanged }) => {
  const { t } = useT();
  const isBody = Boolean(body);
  const place = isBody
    ? { id: body.id, name: body.name, subdomain: body.subdomain }
    : { id: registration?.school?.id, name: registration?.schoolName, subdomain: registration?.school?.subdomain };
  const [current, setCurrent] = useState(place.subdomain ?? null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [isSending, setIsSending] = useState(false);

  if (!place.id) return null;
  const address = schoolAddressOf(current);
  const label = value.trim().toLowerCase();
  const word = (key) => t(isBody ? `${key}.body` : key);

  const submit = (e) => {
    e.preventDefault();
    const fail = subdomainLabelError(value, current);
    /* "This school already uses it" has a body's own words. */
    setError(fail ? t(isBody && fail === 'subdomain.error.same' ? 'subdomain.error.same.body' : fail) : null);
    if (!fail) setConfirming(true);
  };

  const change = async () => {
    setIsSending(true);
    try {
      const answer = isBody ? await adminGoverningBodyService.changeSubdomain(place.id, label) : await adminService.changeSubdomain(place.id, label);
      const next = (isBody ? answer?.governingBody?.subdomain : answer?.school?.subdomain) ?? label;
      setCurrent(next);
      setEditing(false);
      setValue('');
      setError(null);
      showToast?.(t('subdomain.done', { school: place.name, label: next }), 'success');
      onChanged?.(next);
    } catch (err) {
      const said = [String(err?.message ?? ''), ...(Array.isArray(err?.details) ? err.details.map((issue) => String(issue?.message ?? '')) : [])];
      const hit = SUBDOMAIN_BY_MESSAGE.find(([needle]) => said.some((text) => text.includes(needle)));
      setError(hit ? t((isBody && hit[2]) || hit[1]) : apiErrorMessage(err, t));
    } finally {
      setConfirming(false);
      setIsSending(false);
    }
  };

  return (
    <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm space-y-4">
      <div className="min-w-0">
        <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">{word('subdomain.section')}</h3>
        <p className="text-xs font-semibold text-slate-500 mt-1 leading-relaxed">{word('subdomain.lead')}</p>
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
            id={isBody ? 'bodySubdomain' : 'schoolSubdomain'}
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
        title={t('subdomain.confirm.title', { school: place.name })}
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
