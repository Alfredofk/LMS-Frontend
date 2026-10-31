import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import GoogleButton from '../Login/GoogleButton';
import { usersService } from '../../services/usersService';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import { heldRolesOf, isSchoolDeactivated, ROLES } from '../../constants/roles';
import { BusyLabel } from '../../components/ui/ModalHeading';

/*
  Deleting one's own account — backend 7d4b196 (ticket 11, ADR-0007). The last
  card on Settings, for everybody signed in, a role or not.

  **What it does is said before the button**, because it cannot be undone: the
  sign-in details go (email freed, Google unlinked, password and sessions
  ended); the name stays on any school's records, which keep them. A waiting
  join request is cancelled, an active membership ends, and a school
  registration under review is closed with its KTP deleted.

  **Who is held back is the server's rule, said here first.** At a school in
  operation a Principal hands the school over, and a teacher or a student sends a
  leave request, before deleting. At a deactivated school nobody could approve
  either, so anybody may go. The card reads that from the membership and
  explains instead of offering a button the server would refuse; the server
  still decides.

  **Proving it is the account owner**: the password, or for an account made
  through Google (no password) a fresh Google ID token. `/users/me` does not say
  which kind an account is, so the password is asked first, and the server's
  "This account has no password" switches the dialog to Google's button.

  Afterwards every session is already revoked, so the local one is cleared and
  the person lands on sign-in, which says the account is gone.
*/
const HELD_BACK = { PRINCIPAL: 'account.delete.blocked.principal', MEMBER: 'account.delete.blocked.member' };

const DELETE_BY_MESSAGE = [
  ['Password is incorrect', 'account.delete.error.password'],
  ['not the one linked to this account', 'account.delete.error.googleOther'],
  ['cannot be left without its Principal', 'account.delete.blocked.principal'],
  ['leaves with the Principal', 'account.delete.blocked.member'],
  ['already deleted', 'account.delete.error.gone'],
  /* Governing bodies (backend 3d7d05a): before the school's sentence, which they hold. */
  ['governing body registration was decided meanwhile', 'account.delete.error.bodyRegistration'],
  ['An admin application of yours was decided meanwhile', 'account.delete.error.seat'],
  ['An admin seat of yours ended meanwhile', 'account.delete.error.seat'],
  ['decided meanwhile', 'account.delete.error.registration'],
];

/*
  The last admin of a live Governing Body is refused (backend 3d7d05a, ADR-0007), the
  bodies named in `details.governingBodies`. Nothing read before the press can say
  it - a seat's admins are read only from the seat's own sign-in - so it is said on
  the refusal: hand the body on (another admin applies by its code) or ask the
  platform admin.
*/
const LAST_ADMIN = 'cannot be left without an admin';

const DeleteAccountCard = () => {
  const navigate = useNavigate();
  const { user, membership, logout } = useAuth();
  const { t } = useT();

  const [open, setOpen] = useState(false);
  /* What goes, folded under one sentence (owner, 2026-10-28, the reviewed mockup). */
  const [details, setDetails] = useState(false);
  const [mode, setMode] = useState('password'); // 'password' | 'google'
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  /* The server's hold, read ahead of time (users.service.js deleteAccount). */
  /* Sign-in's thin membership carries no status — it only ever sends an ACTIVE one. */
  const running = Boolean(membership) && (membership.status ?? 'ACTIVE') === 'ACTIVE' && !isSchoolDeactivated(membership);
  const held = running ? heldRolesOf(membership) : [];
  const blockedKey = held.includes(ROLES.PRINCIPAL)
    ? HELD_BACK.PRINCIPAL
    : held.includes(ROLES.TEACHER) || held.includes(ROLES.STUDENT)
      ? HELD_BACK.MEMBER
      : null;

  const confirmWord = t('account.delete.word');
  const confirmed = typed.trim().toUpperCase() === confirmWord.toUpperCase();

  const close = () => {
    if (busy) return;
    setOpen(false);
    setMode('password');
    setPassword('');
    setTyped('');
    setError(null);
  };

  const finish = async () => {
    /* Every refresh token is revoked already; this clears what the browser holds. */
    await logout().catch(() => {});
    navigate('/login', { replace: true, state: { deleted: true } });
  };

  const send = async (body) => {
    setBusy(true);
    setError(null);
    try {
      await usersService.deleteMe(body);
      await finish();
    } catch (err) {
      setBusy(false);
      const message = String(err?.message ?? '');
      if (message.includes('has no password')) {
        setMode('google');
        return;
      }
      if (message.includes(LAST_ADMIN)) {
        const bodies = Array.isArray(err?.details?.governingBodies) ? err.details.governingBodies : [];
        setError(t('account.delete.blocked.lastAdmin', { names: bodies.join(', ') || t('account.delete.blocked.lastAdmin.unnamed') }));
        return;
      }
      const hit = DELETE_BY_MESSAGE.find(([needle]) => message.includes(needle));
      setError(hit ? t(hit[1]) : apiErrorMessage(err, t));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (busy || !confirmed) return;
    if (!password) {
      setError(t('account.delete.error.passwordRequired'));
      return;
    }
    send({ password });
  };

  return (
    <section className="border border-rose-200 rounded-2xl p-6 max-sm:p-[18px] bg-white shadow-sm space-y-4 text-left">
      {/* No icon tile beside the title (owner, 2026-10-28). */}
      <div>
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight">{t('account.delete.title')}</h2>
          <p className="text-[13px] text-slate-500 leading-relaxed mt-0.5">{t('account.delete.body')}</p>
          <button
            type="button"
            aria-expanded={details}
            aria-controls="delete-account-details"
            onClick={() => setDetails((value) => !value)}
            className="mt-1.5 text-[13px] font-bold text-brand hover:text-brand-deep cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {t(details ? 'account.delete.less' : 'account.delete.more')}
          </button>
          {details && (
            <ul id="delete-account-details" className="mt-1.5 list-disc pl-5 space-y-1 text-[13px] text-slate-600 leading-relaxed">
              {[1, 2, 3, 4, 5].map((n) => (
                <li key={n}>{t(`account.delete.what.${n}`)}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {blockedKey ? (
        <p className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-800 leading-relaxed">
          {t(blockedKey)}
        </p>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="px-4 py-2.5 rounded-xl border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 text-sm font-bold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            {t('account.delete.open')}
          </button>
        </div>
      )}

      {open &&
        createPortal(
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={close}
          >
            <form
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-account-title"
              aria-describedby="delete-account-body"
              aria-busy={busy}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSubmit}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 sm:p-7 space-y-4 text-left max-h-[90dvh] overflow-y-auto"
              noValidate
            >
              <div className="space-y-2">
                <h2 id="delete-account-title" className="text-base font-extrabold text-slate-900 tracking-tight">
                  {t('account.delete.confirm.title')}
                </h2>
                <p id="delete-account-body" className="text-sm text-slate-600 leading-relaxed">
                  {t('account.delete.confirm.body', { email: user?.email ?? '' })}
                </p>
              </div>

              <Input
                id="deleteConfirmWord"
                name="confirmWord"
                label={t('account.delete.typeWord', { word: confirmWord })}
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={typed}
                onChange={(e) => {
                  setTyped(e.target.value);
                  setError(null);
                }}
              />

              {mode === 'password' ? (
                <Input
                  id="deletePassword"
                  name="password"
                  label={t('account.delete.password')}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                />
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-600 font-semibold leading-relaxed">{t('account.delete.google')}</p>
                  {confirmed ? (
                    <GoogleButton
                      disabled={busy}
                      onCredential={(idToken) => send({ googleIdToken: idToken })}
                    />
                  ) : (
                    <p className="text-[11px] text-slate-500 font-medium">{t('account.delete.google.typeFirst', { word: confirmWord })}</p>
                  )}
                </div>
              )}

              {error && (
                <div className="rounded-xl bg-rose-50 p-3.5 text-[13px] text-rose-700 font-semibold" role="alert">
                  {error}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                <Button type="button" variant="outline" onClick={close} isDisabled={busy}>
                  {t('common.cancel')}
                </Button>
                {mode === 'password' && (
                  <button
                    type="submit"
                    disabled={!confirmed || busy}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                  >
                    <BusyLabel busy={busy}>{t('account.delete.confirm.go')}</BusyLabel>
                  </button>
                )}
              </div>
            </form>
          </div>,
          document.body
        )}
    </section>
  );
};

export default DeleteAccountCard;
