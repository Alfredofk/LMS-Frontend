import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Check, Copy } from 'lucide-react';

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
import { AttentionCard, SchoolsSummary } from './SchoolsOverview';
import useSchoolsOverview from './useSchoolsOverview';
import HomeCard from '../Dashboard/components/HomeCard';

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

  The look since 2026-10-27 (owner approved the yayasan mockup; the skill
  `.claude/skills/eduforid-design`): stat cards and "Kesiapan sekolah" first, then
  "Perlu perhatian" beside the code, the identity beside the site address. The code
  sits large on a pale purple panel with Salin as the one main button; a copy answers
  on the button ("Tersalin", green) and in a toast.
*/

const localeOf = (lang) => (lang === 'en' ? 'en-GB' : 'id-ID');

const Fact = ({ label, children }) => (
  <div className="min-w-0">
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
    <p className="text-sm font-bold text-slate-900 break-words">{children}</p>
  </div>
);

/*
  A copy button that answers where it was pressed: "Tersalin" with a check, green, for
  2.5 s, and a toast; "Gagal menyalin" when the browser refused.
*/
const CopyButton = ({ value, toastKey, primary = false }) => {
  const { t } = useT();
  const { showToast } = useOutletContext() ?? {};
  const [copied, setCopied] = useState(null);
  const copy = async () => {
    const ok = await copyText(value);
    setCopied(ok ? 'ok' : 'failed');
    showToast?.(ok ? t(toastKey) : t('gb.copyFailed'), ok ? 'success' : 'error');
    setTimeout(() => setCopied(null), 2500);
  };
  const done = copied === 'ok';
  return (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
        done
          ? 'bg-emerald-600 text-white'
          : primary
            ? 'bg-brand hover:bg-brand-deep text-white shadow-md shadow-brand/30'
            : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
      }`}
    >
      {done ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
      {done ? t('gb.copied') : copied === 'failed' ? t('gb.copyFailed') : t('gb.copy')}
    </button>
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

  const overview = useSchoolsOverview();
  const name = body?.name ?? cached?.name ?? '';
  const kindKey = kindKeyOf(body?.kind ?? cached?.kind);
  const siteAddress = schoolAddressOf(body?.subdomain ?? null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight break-words">{name || t('gb.nav.home')}</h1>
        <p className="text-sm font-medium text-slate-500 mt-2">
          {kindKey && (
            <>
              {t(kindKey)}{' '}
              <span className="mx-1 text-slate-300" aria-hidden="true">/</span>{' '}
            </>
          )}
          {t('place.governingBodyAdmin')}
          {body?.npyp && (
            <>
              {' '}
              <span className="mx-1 text-slate-300" aria-hidden="true">/</span> {t('gb.npyp')} {body.npyp}
            </>
          )}
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

      {state === 'ready' && body && <SchoolsSummary read={overview.read} failed={overview.failed} onRetry={overview.retry} />}

      {/* "Perlu perhatian" beside the code, the identity beside the address (owner,
          2026-10-27); one column below lg. */}
      {state === 'ready' && body && (
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5">
          <AttentionCard read={overview.read} failed={overview.failed} onRetry={overview.retry} />
          {body.code && (
            <HomeCard id="gb-code" title={t('gb.code')}>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-tint p-4">
                <code key={body.code} className="animate-rise font-mono text-2xl max-sm:text-xl font-bold tracking-[0.18em] text-brand break-all">
                  {body.code}
                </code>
                <CopyButton value={body.code} toastKey="gb.copied.code" primary />
              </div>
              <p className="mt-3 text-[12.5px] text-slate-500 leading-relaxed">{t('gb.code.hint')}</p>
              {rotated && (
                <p className="mt-2 text-xs font-semibold text-emerald-700" role="status">
                  {t('gb.rotate.done')}
                </p>
              )}
              {rotateError && (
                <p className="mt-2 text-xs font-semibold text-rose-700" role="alert">
                  {rotateError}
                </p>
              )}
              <div className="mt-2.5">
                <button
                  type="button"
                  onClick={() => setAskRotate(true)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700 underline underline-offset-2 cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {t('gb.rotate')}
                </button>
              </div>
            </HomeCard>
          )}
        </div>
      )}

      {state === 'ready' && body && (
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5">
          <section aria-labelledby="gb-identity" className="bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 id="gb-identity" className="text-base font-extrabold text-slate-900 tracking-tight">{editing ? t('gb.profile.title') : t('gb.identity')}</h2>
              {!editing && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  {t('gb.profile.edit')}
                </Button>
              )}
            </div>
            {editing ? (
              <div className="animate-rise space-y-4">
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
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
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

          {siteAddress && (
            <HomeCard id="gb-site" title={t('gb.siteAddress')}>
              <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-dashed border-slate-200 px-3.5 py-3">
                <span className="min-w-0 text-sm font-bold text-slate-900 break-all">{siteAddress}</span>
                <CopyButton value={schoolUrl(body.subdomain, '/')} toastKey="gb.copied.site" />
              </div>
              <p className="mt-3 text-[12.5px] text-slate-500 leading-relaxed">{t('gb.siteAddress.hint')}</p>
            </HomeCard>
          )}
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
