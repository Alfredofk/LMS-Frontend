import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage, governingBodySeatErrorMessage } from '../../i18n/apiError';
import { governingBodyService } from '../../services/governingBodyService';
import useMoveOn from './useMoveOn';
import { schoolAddressOf, schoolUrl } from '../../constants/subdomain';
import { copyText } from '../../utils/copyText';
import { addressLineOf, kindKeyOf } from './governingBody';
import GoverningBodyProfileForm from './GoverningBodyProfileForm';
import SchoolsOverview from './SchoolsOverview';

/*
  /governing-body, where a Governing Body seat's sign-in lands (backend b5cfffd;
  owner, 2026-10-24: "a small page" until the body's dashboard, ticket 07). One read,
  `GET /api/governing-body`: the body's name and kind, its SK number (none for a
  government body), its address, its code and - while addresses are in use - its own
  address to hand out.

  A 403 means the seat ended or the body was switched off since this sign-in: said,
  and "Periksa lagi" trades the token in and reads /users/me, which moves the person
  on once the body is no longer theirs (GoverningBodyLayout sends a sign-in without
  one elsewhere). The token comes first: /users/me names the body the token names,
  ended seat or not, and only a refresh drops a seat that no longer opens.

  Since backend 3d7d05a (ticket 04) any admin changes the address and the phone in
  place ("Ubah", GoverningBodyProfileForm) and replaces the code (asked first: the
  old one stops at once, applications already waiting stay).

  At the top since 2026-10-26 (owner, 1-8): the body's Schools summed and what needs the
  admins (SchoolsOverview), read on its own beside `GET /governing-body`.
*/

const localeOf = (lang) => (lang === 'en' ? 'en-GB' : 'id-ID');

const Fact = ({ label, children }) => (
  <div className="min-w-0">
    <p className="text-[11px] font-semibold text-slate-500">{label}</p>
    <p className="text-sm font-bold text-slate-900 break-words">{children}</p>
  </div>
);

/* A value to hand out, with a copy button that says how it went. */
const CopyRow = ({ label, value, copyValue, hint, mono = false, children }) => {
  const { t } = useT();
  const [copied, setCopied] = useState(null);
  const copy = async () => {
    setCopied((await copyText(copyValue ?? value)) ? 'ok' : 'failed');
    setTimeout(() => setCopied(null), 2500);
  };
  return (
    <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-500">{label}</p>
          <p className={`text-sm font-bold text-slate-900 break-all ${mono ? 'font-mono tracking-wider text-base' : ''}`}>{value}</p>
        </div>
        <button
          type="button"
          onClick={copy}
          aria-live="polite"
          className="shrink-0 px-3.5 py-1.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {copied === 'ok' ? t('gb.copied') : copied === 'failed' ? t('gb.copyFailed') : t('gb.copy')}
        </button>
      </div>
      {hint && <p className="text-xs font-medium text-slate-500 leading-relaxed">{hint}</p>}
      {children}
    </section>
  );
};

export const GoverningBodyPage = () => {
  const { governingBody: cached } = useAuth();
  const { t, lang } = useT();
  const moveOn = useMoveOn();
  const { showToast } = useOutletContext() ?? {};

  const [body, setBody] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [askRotate, setAskRotate] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [rotated, setRotated] = useState(false);
  const [rotateError, setRotateError] = useState(null);

  const load = useCallback(() => {
    setState('loading');
    governingBodyService
      .own()
      .then((answer) => {
        setBody(answer);
        setState('ready');
      })
      .catch((err) => {
        setError(err);
        setState(err?.status === 403 ? 'gone' : 'failed');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const checkAgain = async () => {
    setChecking(true);
    try {
      if (!(await moveOn())) load();
    } catch {
      load();
    } finally {
      setChecking(false);
    }
  };

  const rotate = async () => {
    setRotating(true);
    setRotateError(null);
    try {
      const next = await governingBodyService.rotateCode();
      if (next) setBody(next);
      setRotated(true);
    } catch (err) {
      if (err?.status === 403) setState('gone');
      else setRotateError(governingBodySeatErrorMessage(err, t));
    } finally {
      setRotating(false);
      setAskRotate(false);
    }
  };

  const name = body?.name ?? cached?.name ?? '';
  const kindKey = kindKeyOf(body?.kind ?? cached?.kind);
  const siteAddress = schoolAddressOf(body?.subdomain ?? null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight break-words">{name || t('gb.nav.home')}</h1>
        <p className="text-sm font-semibold text-slate-500 mt-1">
          {kindKey && (
            <>
              {t(kindKey)}
              <span className="text-slate-300"> / </span>
            </>
          )}
          {t('place.governingBodyAdmin')}
        </p>
      </div>

      {state === 'loading' && <div className="h-48 rounded-2xl bg-white border border-slate-100 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />}

      {state === 'gone' && (
        <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3" role="alert">
          <p className="text-sm font-bold text-slate-900">{t('gb.gone.title')}</p>
          <p className="text-xs font-medium text-slate-500 leading-relaxed">{t('gb.gone.body')}</p>
          <Button variant="outline" size="sm" onClick={checkAgain} isLoading={checking}>
            {t('gb.checkAgain')}
          </Button>
        </section>
      )}

      {state === 'failed' && (
        <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3" role="alert">
          <p className="text-sm font-semibold text-rose-700">{apiErrorMessage(error, t)}</p>
          <Button variant="outline" size="sm" onClick={load}>
            {t('gb.retry')}
          </Button>
        </section>
      )}

      {/* Two columns from lg (owner, 2026-10-24): the identity wide on the left, the
          two things to hand out stacked on the right; one column below lg. */}
      {state === 'ready' && body && <SchoolsOverview />}

      {state === 'ready' && body && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <section className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-extrabold text-slate-900">{editing ? t('gb.profile.title') : t('gb.identity')}</h2>
              {!editing && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  {t('gb.profile.edit')}
                </Button>
              )}
            </div>
            {editing ? (
              <>
                <p className="text-xs font-medium text-slate-500 leading-relaxed">{t('gb.profile.lead')}</p>
                <GoverningBodyProfileForm
                  body={body}
                  onCancel={() => setEditing(false)}
                  onSaved={(next) => {
                    if (next) setBody(next);
                    setEditing(false);
                    showToast?.(t('gb.profile.done'), 'success');
                  }}
                  onStale={(message) => {
                    setEditing(false);
                    showToast?.(message, 'info');
                    load();
                  }}
                />
              </>
            ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {kindKey && <Fact label={t('gb.kind')}>{t(kindKey)}</Fact>}
              {body.npyp && <Fact label={t('gb.npyp')}>{body.npyp}</Fact>}
              {body.skNumber && <Fact label={t('gb.skNumber')}>{body.skNumber}</Fact>}
              {body.createdAt && (
                <Fact label={t('gb.since')}>
                  {new Date(body.createdAt).toLocaleDateString(localeOf(lang), { day: 'numeric', month: 'long', year: 'numeric' })}
                </Fact>
              )}
              <Fact label={t('gb.phone')}>{body.phone || '-'}</Fact>
              <div className="sm:col-span-2">
                <Fact label={t('gb.address')}>{addressLineOf(body.address) || '-'}</Fact>
              </div>
            </div>
            )}
          </section>

          <div className="space-y-6">
            {body.code && (
              <CopyRow label={t('gb.code')} value={body.code} hint={t('gb.code.hint')} mono>
                {rotated && (
                  <p className="text-xs font-semibold text-emerald-700" role="status">
                    {t('gb.rotate.done')}
                  </p>
                )}
                {rotateError && (
                  <p className="text-xs font-semibold text-rose-700" role="alert">
                    {rotateError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setAskRotate(true)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700 underline underline-offset-2 cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {t('gb.rotate')}
                </button>
              </CopyRow>
            )}
            {siteAddress && <CopyRow label={t('gb.siteAddress')} value={siteAddress} copyValue={schoolUrl(body.subdomain, '/')} hint={t('gb.siteAddress.hint')} />}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={askRotate}
        title={t('gb.rotate.title')}
        body={t('gb.rotate.body', { code: body?.code ?? '' })}
        confirmLabel={t('gb.rotate.confirm')}
        cancelLabel={t('common.cancel')}
        tone="brand"
        busy={rotating}
        busyLabel={t('gb.rotate.busy')}
        onCancel={() => setAskRotate(false)}
        onConfirm={rotate}
      />
    </div>
  );
};

export default GoverningBodyPage;
