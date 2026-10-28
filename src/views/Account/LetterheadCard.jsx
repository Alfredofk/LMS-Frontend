import React, { useEffect, useRef, useState } from 'react';

import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { letterheadErrorMessage } from '../../i18n/apiError';
import { schoolService } from '../../services/schoolService';
import { ADDRESS_MAX, PHONE_MAX, letterheadBody, letterheadDraftOf, letterheadErrors, logoFileError, logoSizeError } from './letterhead';

/*
  "Kop rapor" (owner, 2026-10-22; backend 4dae152, grading-and-report-card ticket 10):
  the school's address, phone and logo printed above every report card, the
  Principal's alone, on Settings. The address and phone are one form, saved with
  `PATCH /school/letterhead` (only what changed; an emptied one is cleared). The logo
  is saved the moment it is picked (`PUT /school/logo`, a JPG or PNG of at most 2 MB
  and 2000 x 2000 pixels, checked here first and by the server again) and removed
  after a question (`DELETE /school/logo`); it is shown from its bytes, read with the
  token. Every change is audited, and reaches only the report cards closed after it.

  What is saved comes from `/users/me` (`membership.school.letterhead`), read once on
  mount as SchoolPlaceCard does, and again after each save.
*/

const field =
  'block w-full px-3 py-2 rounded-xl border bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand';

/** Reads the picked image's pixels; null when the browser cannot decode it (the server judges then). */
function imageSizeOf(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

const LetterheadCard = ({ onToast }) => {
  const { membership, refreshMe } = useAuth();
  const { t } = useT();

  const asked = useRef(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    refreshMe()
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [refreshMe]);

  /* What this card saved since /users/me was read, which wins over it until the next read. */
  const [savedHere, setSavedHere] = useState(null);
  const letterhead = savedHere ?? membership?.school?.letterhead ?? null;

  /* null until the reader edits: the form shows what is saved until then. */
  const [draft, setDraft] = useState(null);
  const values = draft ?? letterheadDraftOf(letterhead);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const [logoUrl, setLogoUrl] = useState(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState(null);
  const [askRemove, setAskRemove] = useState(false);
  /* Bumped after a new logo is saved, to show its bytes. */
  const [logoStamp, setLogoStamp] = useState(0);
  const picker = useRef(null);

  const hasLogo = Boolean(letterhead?.hasLogo);
  useEffect(() => {
    if (!hasLogo) {
      setLogoUrl(null);
      return undefined;
    }
    let cancelled = false;
    let url = null;
    schoolService
      .logo()
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setLogoUrl(url);
      })
      .catch(() => !cancelled && setLogoUrl(null));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [hasLogo, logoStamp]);

  const change = (name, value) => {
    setDraft((prev) => ({ ...(prev ?? letterheadDraftOf(letterhead)), [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null, global: null }));
  };

  const afterWrite = (answer) => {
    if (answer) setSavedHere(answer);
    refreshMe()
      .then(() => setSavedHere(null))
      .catch(() => {});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    const found = letterheadErrors(values);
    if (Object.keys(found).length) {
      setErrors(Object.fromEntries(Object.entries(found).map(([key, value]) => [key, t(value, { max: key === 'address' ? ADDRESS_MAX : PHONE_MAX })])));
      return;
    }
    const body = letterheadBody(letterhead, values);
    if (!body) {
      setErrors({ global: t('classes.edit.nothing') });
      return;
    }
    setIsSaving(true);
    try {
      afterWrite(await schoolService.updateLetterhead(body));
      setDraft(null);
      setErrors({});
      onToast?.(t('kop.saved'), 'success');
    } catch (err) {
      setErrors({ global: letterheadErrorMessage(err, t) });
    } finally {
      setIsSaving(false);
    }
  };

  const pickLogo = async (file) => {
    if (!file) return;
    setLogoError(null);
    const typeError = logoFileError(file);
    if (typeError) {
      setLogoError(t(typeError));
      return;
    }
    const size = await imageSizeOf(file);
    const pixels = size ? logoSizeError(size.width, size.height) : null;
    if (pixels) {
      setLogoError(t(pixels));
      return;
    }
    setLogoBusy(true);
    try {
      afterWrite(await schoolService.setLogo(file));
      setLogoStamp((n) => n + 1);
      onToast?.(t('kop.logo.saved'), 'success');
    } catch (err) {
      setLogoError(letterheadErrorMessage(err, t));
    } finally {
      setLogoBusy(false);
    }
  };

  const removeLogo = async () => {
    setAskRemove(false);
    setLogoBusy(true);
    setLogoError(null);
    try {
      afterWrite(await schoolService.removeLogo());
      onToast?.(t('kop.logo.removed'), 'success');
    } catch (err) {
      setLogoError(letterheadErrorMessage(err, t));
    } finally {
      setLogoBusy(false);
    }
  };

  const addressLength = values.address.trim().length;
  const phoneLength = values.phone.trim().length;

  return (
    <section className="border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] bg-white shadow-sm space-y-4 text-left">
      <div className="min-w-0">
        <h2 className="text-base font-extrabold text-slate-900 tracking-tight">{t('kop.title')}</h2>
        <p className="text-[13px] text-slate-500 leading-relaxed mt-0.5">{t('kop.body')}</p>
      </div>

      {!loaded ? (
        <div className="h-40 bg-slate-50 rounded-2xl animate-pulse" aria-label={t('common.loading')} />
      ) : (
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-bold text-slate-700">{t('kop.logo.label')}</p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-24 h-24 rounded-xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                {hasLogo && logoUrl ? (
                  <img src={logoUrl} alt={t('kop.logo.alt')} className="max-w-full max-h-full object-contain" />
                ) : (
                  <span className="text-[11px] font-semibold text-slate-500 text-center px-2">{hasLogo ? t('common.loading') : t('kop.logo.none')}</span>
                )}
              </div>
              <div className="space-y-2 min-w-0">
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={picker}
                    type="file"
                    accept="image/jpeg,image/png"
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      pickLogo(file);
                    }}
                  />
                  <Button type="button" variant="outline" onClick={() => picker.current?.click()} isLoading={logoBusy}>
                    {hasLogo ? t('kop.logo.replace') : t('kop.logo.pick')}
                  </Button>
                  {hasLogo && (
                    <Button type="button" variant="outline" onClick={() => setAskRemove(true)} isDisabled={logoBusy}>
                      {t('kop.logo.remove')}
                    </Button>
                  )}
                </div>
                <p className="text-[11px] font-medium text-slate-500 leading-relaxed">{t('kop.logo.hint')}</p>
                {logoError && (
                  <p className="text-xs font-semibold text-red-600" role="alert">
                    {logoError}
                  </p>
                )}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 border-t border-slate-100 pt-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="kopAddress" className="block text-sm font-bold text-slate-700">
                {t('kop.address')}
              </label>
              <textarea
                id="kopAddress"
                name="address"
                rows={2}
                value={values.address}
                onChange={(e) => change('address', e.target.value)}
                disabled={isSaving}
                placeholder={t('kop.address.placeholder')}
                aria-invalid={Boolean(errors.address)}
                className={`${field} field-sizing-content min-h-[3.5rem] resize-y ${errors.address ? 'border-rose-300' : 'border-slate-200'}`}
              />
              <div className="flex flex-wrap justify-between gap-x-4 text-[11px] font-semibold">
                <span className="text-red-600">{errors.address || ''}</span>
                <span className={`tabular-nums ${addressLength > ADDRESS_MAX ? 'text-rose-700' : 'text-slate-500'}`}>
                  {t('homeroom.notes.counter', { n: addressLength, max: ADDRESS_MAX })}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="kopPhone" className="block text-sm font-bold text-slate-700">
                {t('kop.phone')}
              </label>
              <input
                id="kopPhone"
                name="phone"
                type="tel"
                autoComplete="off"
                value={values.phone}
                onChange={(e) => change('phone', e.target.value)}
                disabled={isSaving}
                placeholder={t('kop.phone.placeholder')}
                aria-invalid={Boolean(errors.phone)}
                className={`${field} max-w-xs ${errors.phone ? 'border-rose-300' : 'border-slate-200'}`}
              />
              {(errors.phone || phoneLength > PHONE_MAX) && <p className="text-xs font-semibold text-red-600">{errors.phone || t('kop.error.phoneLong', { max: PHONE_MAX })}</p>}
            </div>

            <p className="text-[11px] font-medium text-slate-500 leading-relaxed">{t('kop.note')}</p>

            {errors.global && (
              <div className="rounded-xl bg-rose-50 p-3.5 text-[13px] text-rose-700 font-semibold" role="alert">
                {errors.global}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              {draft && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDraft(null);
                    setErrors({});
                  }}
                  isDisabled={isSaving}
                >
                  {t('common.cancel')}
                </Button>
              )}
              <Button type="submit" isLoading={isSaving}>
                {t('classes.edit.save')}
              </Button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={askRemove}
        tone="danger"
        title={t('kop.logo.removeTitle')}
        body={t('kop.logo.removeBody')}
        confirmLabel={t('kop.logo.remove')}
        cancelLabel={t('common.cancel')}
        onConfirm={removeLogo}
        onCancel={() => setAskRemove(false)}
      />
    </section>
  );
};

export default LetterheadCard;
