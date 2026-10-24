import React, { useState } from 'react';

import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Input from '../../components/ui/Input';
import SelectField from '../../components/ui/SelectField';
import { adminGoverningBodyService } from '../../services/adminGoverningBodyService';
import { governingBodyAdminErrorMessage, isStaleGoverningBody } from '../../i18n/apiError';
import { useT } from '../../i18n/LanguageContext';
import { GOVERNING_BODY_KINDS } from '../GoverningBody/governingBody';
import { correctionErrorsOf, correctionFormOf, correctionPatchOf, npypRequiredOf, takesSk } from './bodyDecisions';

/*
  Correcting a body's name, kind or SK number (backend b5cfffd, `PATCH
  /admin/governing-bodies/:id`; owner 2026-10-24): the Platform Admin's, on the
  approved registration's review. Only what changed is sent (`correctionPatchOf`),
  after a question - the change is audited with what it was, and the subdomain stays.
  A government body takes no numbers, so the boxes go when Dinas is chosen and the
  numbers are removed. Since backend c79b56f the other two have an NPYP - required
  once held, or when a Dinas becomes one; a body from before with none may stay
  without, or get one here - and an SK number only if they have one.

  `onSaved(governingBody)` with the answer; `onStale()` when the body changed or went
  meanwhile, for the page to read the queue again.
*/
export const GoverningBodyCorrectionPanel = ({ body, showToast, onSaved, onStale }) => {
  const { t } = useT();
  const [form, setForm] = useState(() => correctionFormOf(body));
  const [errors, setErrors] = useState({});
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const patch = correctionPatchOf(body, form);
  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setError(null);
  };

  const ask = () => {
    const found = correctionErrorsOf(form, body);
    setErrors(found);
    if (Object.keys(found).length === 0 && patch) setAsking(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const answer = await adminGoverningBodyService.update(body.id, patch);
      setAsking(false);
      showToast?.(t('gbr.edit.done'), 'success');
      onSaved(answer.governingBody);
    } catch (err) {
      setAsking(false);
      if (isStaleGoverningBody(err)) {
        showToast?.(governingBodyAdminErrorMessage(err, t), 'info');
        onStale();
        return;
      }
      setError(governingBodyAdminErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm space-y-4">
      <div>
        <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">{t('gbr.edit.title')}</h3>
        <p className="text-xs font-semibold text-slate-500 mt-1 leading-relaxed">{t('gbr.edit.lead')}</p>
      </div>

      <Input id="gbName" label={t('gbr.field.name')} value={form.name} onChange={set('name')} maxLength={150} error={errors.name && t(errors.name)} />
      <SelectField id="gbKind" label={t('gb.kind')} value={form.kind} onChange={set('kind')} error={errors.kind && t(errors.kind)}>
        {GOVERNING_BODY_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {t(`gb.kind.${kind}`)}
          </option>
        ))}
      </SelectField>
      {takesSk(form.kind) ? (
        <>
          <div className="space-y-1">
            <Input
              id="gbNpyp"
              label={t(npypRequiredOf(body, form.kind) ? 'gb.npyp' : 'gbr.edit.npyp.optional')}
              value={form.npyp}
              onChange={set('npyp')}
              maxLength={6}
              autoCapitalize="characters"
              error={errors.npyp && t(errors.npyp)}
            />
            {!errors.npyp && !npypRequiredOf(body, form.kind) && <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{t('gbr.edit.npyp.before')}</p>}
          </div>
          <Input id="gbSk" label={t('gbreg.field.skNumber.optional')} value={form.skNumber} onChange={set('skNumber')} maxLength={120} error={errors.skNumber && t(errors.skNumber)} />
        </>
      ) : (
        <p className="text-xs font-medium text-slate-500 leading-relaxed">{t('gbr.edit.noSk')}</p>
      )}

      {error && (
        <p className="text-sm font-semibold text-rose-700" role="alert">
          {error}
        </p>
      )}

      <Button type="button" variant="outline" onClick={ask} isDisabled={!patch || saving} className="w-full justify-center">
        {t('gbr.edit.save')}
      </Button>

      <ConfirmDialog
        open={asking}
        title={t('gbr.edit.confirm.title', { name: body.name })}
        body={t('gbr.edit.confirm.body')}
        confirmLabel={t('gbr.edit.save')}
        cancelLabel={t('common.cancel')}
        tone="brand"
        busy={saving}
        busyLabel={t('gbr.saving')}
        onCancel={() => setAsking(false)}
        onConfirm={save}
      />
    </section>
  );
};

export default GoverningBodyCorrectionPanel;
