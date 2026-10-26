import React, { useCallback, useEffect, useRef, useState } from 'react';

import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Input from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { affiliationRequestErrorMessage, isAlreadyGoverned } from '../../i18n/apiError';
import { governingBodyService } from '../../services/governingBodyService';
import { schoolService } from '../../services/schoolService';
import { kindKeyOf } from '../GoverningBody/governingBody';
import { normaliseBodyCode, validateBodyCode } from '../Role/bodyApplication';
import { affiliationStateOf } from './affiliation';

/*
  "Yayasan" on Settings, the Principal's alone (backend 261a9c7, governing-body ticket
  08; owner 2026-10-26, F1-F6): an independent School asking a yayasan, perkumpulan or
  dinas to take it in, with the body's code.

  - Two steps, as asking to be a body's admin: the code alone, looked up
    (`POST /governing-body-applications/lookup`, its name and kind), then a confirmation
    saying what the body may do once it says yes - make and end the Principal, switch the
    School off, let it go - and `POST /school/affiliation-requests`.
  - Its state from the School's requests (`affiliationStateOf`): waiting, with "Batalkan"
    (asked); turned down, with the reason and the form again; approved, told as history
    beside the form - a School let go keeps that request, so it cannot mean "joined"
    (walked 2026-10-26). Under a body (`/users/me`'s `school.governingBody`, backend
    227473f, read once here when the cached membership is the thin one) the card is one
    line naming it (owner 2026-10-26, D); a refusal "already belongs" says so too.
  - A 403 (no longer the Principal) hides the card. A read that fails leaves the form.
*/

const localeOf = (lang) => (lang === 'en' ? 'en-GB' : 'id-ID');

export const AffiliationCard = ({ onToast }) => {
  const { t, lang } = useT();
  const { membership, refreshMe } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [governed, setGoverned] = useState(false);
  const [code, setCode] = useState('');
  const [body, setBody] = useState(null);
  const [error, setError] = useState(null);
  const [isWorking, setIsWorking] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);

  const asDate = (value) => (value ? new Date(value).toLocaleDateString(localeOf(lang), { day: 'numeric', month: 'long', year: 'numeric' }) : '');

  const load = useCallback(
    () =>
      schoolService
        .affiliationRequests()
        .then(setRequests)
        .catch((err) => {
          if (err?.status === 403) setHidden(true);
        })
        .finally(() => setLoaded(true)),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  /* Sign-in's membership is the thin one, without the body: /users/me once, when so. */
  const bodyKnown = membership?.school?.governingBody !== undefined;
  const asked = useRef(false);
  const [meRead, setMeRead] = useState(false);
  useEffect(() => {
    if (bodyKnown || asked.current) return;
    asked.current = true;
    refreshMe()
      .catch(() => {})
      .finally(() => setMeRead(true));
  }, [bodyKnown, refreshMe]);

  const refused = (err) => {
    if (err?.status === 403) {
      setHidden(true);
      return;
    }
    if (isAlreadyGoverned(err)) {
      setGoverned(true);
      setBody(null);
      refreshMe().catch(() => {});
      return;
    }
    setError(affiliationRequestErrorMessage(err, t));
  };

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
      refused(err);
    } finally {
      setIsWorking(false);
    }
  };

  const send = async () => {
    if (isWorking) return;
    setError(null);
    setIsWorking(true);
    try {
      await schoolService.requestAffiliation(normaliseBodyCode(code));
      onToast?.(t('aff.sent', { name: body.name }), 'success');
      setBody(null);
      setCode('');
      await load();
    } catch (err) {
      refused(err);
      if (String(err?.message ?? '').includes('waiting')) load();
    } finally {
      setIsWorking(false);
    }
  };

  const cancel = async () => {
    const waiting = state.request;
    setBusy(true);
    try {
      await schoolService.cancelAffiliation(waiting.id);
      onToast?.(t('aff.cancelled', { name: waiting.governingBody.name }), 'success');
    } catch (err) {
      onToast?.(affiliationRequestErrorMessage(err, t), 'info');
    } finally {
      setBusy(false);
      setCancelling(false);
      load();
    }
  };

  if (hidden) return null;

  const state = affiliationStateOf(requests, { governed, bodyName: membership?.school?.governingBody?.name ?? null });
  const ready = loaded && (bodyKnown || meRead);

  return (
    <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm space-y-4 text-left">
      <div className="min-w-0">
        <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">{t('aff.title')}</h2>
        <p className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5">{t('aff.body')}</p>
      </div>

      {!ready ? (
        <div className="h-24 bg-slate-50 rounded-2xl animate-pulse" aria-label={t('common.loading')} />
      ) : state.state === 'MEMBER' ? (
        <p className="text-sm font-semibold text-slate-700 break-words">{state.bodyName ? t('aff.member', { name: state.bodyName }) : t('aff.memberUnknown')}</p>
      ) : state.state === 'WAITING' ? (
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-700 break-words">{t('aff.waiting', { name: state.request.governingBody.name })}</p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{t('aff.askedBy', { name: state.request.requestedBy.fullName, date: asDate(state.request.requestedAt) })}</p>
          </div>
          <Button size="sm" variant="dangerOutline" onClick={() => setCancelling(true)}>
            {t('others.cancel')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {state.approved && (
            <p className="text-xs font-semibold text-slate-600 leading-relaxed break-words">
              {t('aff.approvedBefore', { name: state.request.governingBody.name, date: asDate(state.request.decidedAt) })}
            </p>
          )}
          {state.rejected && (
            <div className="text-xs font-semibold leading-relaxed">
              <p className="text-rose-700 break-words">{t('aff.rejected', { name: state.request.governingBody.name })}</p>
              {state.request.rejectionReason && <p className="text-slate-600 break-words mt-0.5">{t('others.reason', { reason: state.request.rejectionReason })}</p>}
            </div>
          )}

          {!body ? (
            <form onSubmit={lookup} className="space-y-3 max-w-md" noValidate>
              <Input
                id="affiliationCode"
                name="affiliationCode"
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
              <p className="text-xs text-slate-500 font-medium leading-relaxed">{t('aff.code.hint')}</p>
              <Button type="submit" size="sm" variant="outline" isLoading={isWorking}>
                {t('gbapp.lookup')}
              </Button>
            </form>
          ) : (
            <div className="space-y-3 max-w-md">
              <div className="p-4 rounded-2xl bg-brand-tint/60 border border-brand/20">
                <p className="text-sm font-extrabold text-slate-900 leading-tight break-words">{body.name}</p>
                {kindKeyOf(body.kind) && <p className="text-xs font-semibold text-slate-600 mt-1">{t(kindKeyOf(body.kind))}</p>}
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
              <p className="text-xs text-slate-600 font-medium leading-relaxed">{t('aff.consequences')}</p>
              {error && (
                <p className="text-xs text-red-700 font-semibold" role="alert">
                  {error}
                </p>
              )}
              <Button size="sm" onClick={send} isLoading={isWorking}>
                {t('aff.send')}
              </Button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={cancelling}
        tone="danger"
        title={t('aff.cancel.title')}
        body={state.request ? t('aff.cancel.body', { name: state.request.governingBody.name }) : ''}
        confirmLabel={t('selectRole.cancel.confirm')}
        cancelLabel={t('selectRole.cancel.keep')}
        busy={busy}
        busyLabel={t('common.loading')}
        onCancel={() => setCancelling(false)}
        onConfirm={cancel}
      />
    </section>
  );
};

export default AffiliationCard;
