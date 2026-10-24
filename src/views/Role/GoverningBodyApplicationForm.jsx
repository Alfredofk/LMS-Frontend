import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Landmark } from 'lucide-react';

import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { governingBodyService } from '../../services/governingBodyService';
import { useT } from '../../i18n/LanguageContext';
import { bodyApplicationErrorMessage } from '../../i18n/apiError';
import { kindKeyOf } from '../GoverningBody/governingBody';
import { normaliseBodyCode, validateBodyCode } from './bodyApplication';

/*
  Asking to be an admin of a yayasan, perkumpulan or dinas that already exists
  (backend 3d7d05a, governing-body ticket 04; owner 2026-10-24:
  /get-started/governing-body-admin, linked from /select-role and My Profile).

  Two steps, as joining a school: `POST /governing-body-applications/lookup` names
  the body (its name and kind, nothing else), so somebody can say "wrong one"
  before asking; then `POST .../admins` with the code alone. The senior admin
  decides, and every admin of the body sees the applicant's name and email - the
  second step says so. A wrong code draws on the same budget as a wrong School Code.
*/
export const GoverningBodyApplicationForm = ({ doneTo = '/select-role' }) => {
  const navigate = useNavigate();
  const { t } = useT();

  const [code, setCode] = useState('');
  const [body, setBody] = useState(null);
  const [error, setError] = useState(null);
  const [isWorking, setIsWorking] = useState(false);

  const lookup = async (e) => {
    e.preventDefault();
    if (isWorking) return;
    const fail = validateBodyCode(code);
    if (fail) {
      setError(t(fail.key));
      return;
    }
    setError(null);
    setIsWorking(true);
    try {
      const found = await governingBodyService.lookup(normaliseBodyCode(code));
      if (!found?.name) setError(t('error.unknown'));
      else setBody(found);
    } catch (err) {
      setError(bodyApplicationErrorMessage(err, t));
    } finally {
      setIsWorking(false);
    }
  };

  const apply = async (e) => {
    e.preventDefault();
    if (isWorking) return;
    setError(null);
    setIsWorking(true);
    try {
      await governingBodyService.apply(normaliseBodyCode(code));
      navigate(doneTo, { replace: true });
    } catch (err) {
      setError(bodyApplicationErrorMessage(err, t));
      setIsWorking(false);
    }
  };

  if (!body) {
    return (
      <form onSubmit={lookup} className="space-y-5 text-left" noValidate>
        <Input
          id="bodyCode"
          name="bodyCode"
          label={t('gbapp.code.label')}
          type="text"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="characters"
          placeholder={t('getStarted.join.field.codePlaceholder')}
          value={code}
          error={error || undefined}
          onChange={(e) => {
            setCode(e.target.value);
            if (error) setError(null);
          }}
        />
        <p className="text-xs text-slate-500 font-medium leading-relaxed">{t('gbapp.code.hint')}</p>
        <Button type="submit" size="lg" className="w-full" isLoading={isWorking}>
          {t('gbapp.lookup')}
        </Button>
      </form>
    );
  }

  const kindKey = kindKeyOf(body.kind);

  return (
    <form onSubmit={apply} className="space-y-5 text-left" noValidate>
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-brand-tint/60 border border-brand/20">
        <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm">
          <Landmark className="w-4 h-4 text-brand" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-slate-900 leading-tight break-words">{body.name}</p>
          {kindKey && <p className="text-xs font-semibold text-slate-600 mt-1">{t(kindKey)}</p>}
          <button
            type="button"
            onClick={() => {
              setBody(null);
              setError(null);
            }}
            className="mt-1.5 text-[11px] font-extrabold text-brand hover:text-brand-deep underline underline-offset-2 cursor-pointer focus:outline-none"
          >
            {t('gbapp.changeCode')}
          </button>
        </div>
        <Check className="w-4 h-4 text-brand shrink-0 mt-2.5" aria-hidden="true" />
      </div>

      <p className="text-xs text-slate-500 font-medium leading-relaxed">{t('gbapp.apply.note')}</p>

      {error && (
        <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
          {error}
        </div>
      )}

      <Button type="submit" size="lg" className="w-full" isLoading={isWorking}>
        {t('gbapp.apply.action')}
      </Button>
    </form>
  );
};

export default GoverningBodyApplicationForm;
