import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import AuthLayout from '../../layouts/AuthLayout';
import Toast from '../../components/ui/Toast';
import LanguageSwitch from '../../components/ui/LanguageSwitch';
import FactLine from '../../components/ui/FactLine';
import { useTheme } from '../../theme/useTheme';
import ProfileForm from './ProfileForm';
import PasswordForm from './PasswordForm';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { GOVERNING_BODY_HOME, homeFor, roleTitleKey, ROLES } from '../../constants/roles';
import LeaveCard from './LeaveCard';
import SchoolPlaceCard from './SchoolPlaceCard';
import SchoolGradeSettingsCard from '../Grading/SchoolGradeSettingsCard';
import SignalSettingsCard from './SignalSettingsCard';
import LetterheadCard from './LetterheadCard';
import AffiliationCard from './AffiliationCard';
import HandoverCard from './HandoverCard';
import DeleteAccountCard from './DeleteAccountCard';

/*
  Settings — "Pengaturan". It was "Account & Security" until the account group
  left the sidebar for the avatar menu; the path stays /account, because
  /select-role and the navbar's title table both point at it.

  **Guarded by RequireAuth, not ProtectedRoute**, and that is why it exists as
  its own route rather than as a section of /profile.

  Nothing in this app can hand a real account an active role yet: approving a
  school registration needs a PlatformAdmin row, no route creates one, and the
  seed that would is not on disk. So every role-guarded screen — /profile
  included — is reachable only through the dev sign-in buttons. This one is not.
  Somebody who registered ten minutes ago and whose school is still PENDING can
  open it and change their own name and password, which is the only real,
  finished thing this frontend can offer them today.

  The body below is the same for everybody. What wraps it is not, and that part
  lives in AccountChrome: inside the app for anybody holding a role, standing on
  its own for anybody who is not. Only the standalone half carries a heading and
  a way back — inside the shell the navbar already names the page and the
  sidebar is the way out, and a second copy of each would compete with them.
*/

/* The dashboards' card frame since 2026-10-28 (owner, the reviewed mockup); every card on
   this page wears it, the ones in their own files too. */
const Card = ({ title, children, className = '' }) => (
  <section className={`border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] bg-white shadow-sm space-y-4 text-left ${className}`}>
    <h2 className="text-base font-extrabold text-slate-900 tracking-tight">{title}</h2>
    {children}
  </section>
);

/* A leader's twelve cards ran 5,776px on a phone, so they sit on three text tabs, kept in
   `?tab=` (owner, 2026-10-28, choice A). Everybody else has six and no tabs. */
const TABS = ['account', 'school', 'leave'];

export const AccountPage = () => {
  const navigate = useNavigate();
  const { user, membership, activeRole, governingBody } = useAuth();
  const { t } = useT();
  const { isDark, followsDevice, setDark } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  const leads = activeRole === ROLES.PRINCIPAL || activeRole === ROLES.VICE_PRINCIPAL;
  const tab = leads && TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'account';
  /* With no tabs every part shows. */
  const shows = (part) => !leads || tab === part;
  const toast_ = (message, type) => setToast({ message, type });

  const [toast, setToast] = useState(null);

  /*
    "Leave the school" is the last card, and how it works depends on who is
    reading (LeaveCard, backend 75e2fdd): a teacher or a student sends a letter
    for the Principal to decide (owner, 2026-09-24/26), a guardian leaves at
    once, a Principal cannot. Only inside the app — the standalone branch below
    belongs to somebody with no role, who has nothing to leave.
  */

  const body = (
    <>
      <Card title={t('account.profile.title')} className="flex flex-col">
        <ProfileForm
          onSaved={() => setToast({ message: t('account.profile.saved'), type: 'success' })}
        />
      </Card>

      <Card title={t('account.pwd.title')} className="flex flex-col">
        <PasswordForm
          onChanged={() => setToast({ message: t('account.pwd.changed'), type: 'success' })}
        />
      </Card>
    </>
  );

  const notice = toast && (
    <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
  );

  if (activeRole) {
    return (
      <>
        {notice}
        <div className="space-y-6">
          {/*
            The branch below this one has its own heading, inside AuthLayout. This
            one had none at all — the only page in the shell without one, so a
            screen reader arriving here was told the sidebar name and then nothing
            about where it had landed. Slate rather than brand: the purple title
            belongs to the purple column, and there is no purple column here.
          */}
          {/* School / the role in use / the email, one grey line (owner, 2026-10-28). */}
          <div>
            <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
              {t('account.title')}
            </h1>
            <FactLine
              className="mt-2"
              wrap
              facts={[membership?.school?.name ?? membership?.schoolName, t(roleTitleKey(activeRole)), user?.email]}
            />
          </div>

          {leads && (
            <div role="tablist" className="flex gap-0.5 select-none overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-[inset_0_-1px_0_var(--color-slate-100)]">
              {TABS.map((name) => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={tab === name}
                  onClick={() => setSearchParams(name === 'account' ? {} : { tab: name }, { replace: true })}
                  className={`px-2.5 py-2 text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus-visible:text-brand ${
                    tab === name ? 'text-brand border-brand' : 'text-slate-500 border-transparent hover:text-slate-700'
                  }`}
                >
                  {t(`account.tab.${name}`)}
                </button>
              ))}
            </div>
          )}

          {/*
            Two columns, because every other page inside this shell fills its
            width — ProfilePage on a 12-column grid, both dashboards on their
            own. A single narrow column capped at max-w-2xl left roughly a
            third of the content area empty on the right and nothing on the
            left, which read as a layout bug rather than as a choice.

            `body` is a fragment, and fragments emit no DOM node, so its two
            cards become grid items directly.

            The two cards stretch to one height and each form's button sits at
            the card's foot (`mt-auto` in ProfileForm/PasswordForm), so the two
            buttons line up. It used to be `items-start`, which left the shorter
            profile card ending 65-95px above the password card on a wide
            screen - a hole the owner read as unfinished (2026-10-08).
          */}
          {/*
            The language used to be switched from the foot of the sidebar, on
            screen at all times for something changed once. It lives here now.
            Only in this branch: the standalone one below sits in AuthLayout,
            whose purple column already carries the same switch.
          */}
          {/* Language and theme side by side on a wide screen: each is one line,
              and at full width they were two long, nearly empty bars (2026-10-08). */}
          {shows('account') && (
          <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title={t('account.language.title')}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {t('account.language.hint')}
              </p>
              <LanguageSwitch className="self-start sm:self-auto shrink-0" />
            </div>
          </Card>

          {/*
            Dark mode, as one switch. Nobody has to choose: until they do, the
            device decides, and the hint says so — the switch shows what is on
            screen now, which is the only honest state for it to show.
          */}
          <Card title={t('account.theme.title')}>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p id="theme-switch-label" className="text-sm font-semibold text-slate-800">
                  {t('account.theme.dark')}
                </p>
                <p className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5">
                  {t(followsDevice ? 'account.theme.hint.device' : 'account.theme.hint.chosen')}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isDark}
                aria-labelledby="theme-switch-label"
                onClick={() => setDark(!isDark)}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                  isDark ? 'bg-brand' : 'bg-slate-300'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    isDark ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {body}
          </div>
          </>
          )}

          {/* The school's point and time zone — the Principal's to set (SchoolPlaceCard). */}
          {shows('school') && activeRole === ROLES.PRINCIPAL && <SchoolPlaceCard onToast={toast_} />}

          {/* The school's grade weights, KKTP and remedial rule - the Principal's and a
              Vice Principal's to set (backend 5d42af6, SchoolGradeSettingsCard). */}
          {shows('school') && leads && <SchoolGradeSettingsCard onToast={toast_} />}

          {/* When a teacher's dashboard flags a student as needing support - the Principal's
              and a Vice Principal's to set (backend 002298e, SignalSettingsCard). */}
          {shows('school') && leads && <SignalSettingsCard onToast={toast_} />}

          {/* The report card's letterhead - the Principal's alone (backend 4dae152, LetterheadCard). */}
          {shows('school') && activeRole === ROLES.PRINCIPAL && <LetterheadCard onToast={toast_} />}

          {/* Asking a foundation to take an independent school in - the Principal's alone (backend 261a9c7, AffiliationCard). */}
          {shows('school') && activeRole === ROLES.PRINCIPAL && <AffiliationCard onToast={toast_} />}

          {/* Handing the school to a new Principal — the only way a Principal leaves. */}
          {shows('leave') && activeRole === ROLES.PRINCIPAL && <HandoverCard />}

          {shows('leave') && <LeaveCard onToast={toast_} />}

          {/* Last, and apart: deleting the account itself (DeleteAccountCard). */}
          {shows('leave') && <DeleteAccountCard />}

        </div>
      </>
    );
  }

  /* No role: the signed-in shell cannot be built, so the page carries its own
     frame, its own title and its own way back. homeFor falls through to the
     role picker, which is where somebody in this state belongs - or, for a
     Governing Body seat's sign-in (backend b5cfffd), the body's page. */
  const footer = (
    <button
      type="button"
      onClick={() => navigate(governingBody?.id ? GOVERNING_BODY_HOME : homeFor(activeRole))}
      className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand font-bold transition-colors focus:outline-none focus-visible:text-brand cursor-pointer"
    >
      <ArrowLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      {t('account.back')}
    </button>
  );

  return (
    <>
      {notice}

      <AuthLayout
        heading={t('account.panel.heading')}
        blurb={t('account.panel.blurb')}
        footer={footer}
      >
        <div className="text-left">
          {/* h2: inside AuthLayout, whose purple column owns the h1. The other
              branch of this file keeps its h1 — it renders in the app shell, which
              has no heading of its own. */}
          <h2 className="text-3xl sm:text-[34px] font-extrabold text-brand leading-tight select-none">
            {t('account.title')}
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-2 font-semibold break-all">
            {user?.email ? t('account.subtitle', { email: user.email }) : ''}
          </p>
        </div>

        {body}

        {/* Somebody with no role may delete their account too — the route asks no membership. */}
        <DeleteAccountCard />
      </AuthLayout>
    </>
  );
};

export default AccountPage;
