import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import AuthLayout from '../../layouts/AuthLayout';
import Toast from '../../components/ui/Toast';
import ProfileForm from './ProfileForm';
import PasswordForm from './PasswordForm';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { homeFor } from '../../constants/roles';

/*
  Account & Security.

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

const Card = ({ title, children }) => (
  <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm space-y-4 text-left">
    <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">{title}</h2>
    {children}
  </section>
);

export const AccountPage = () => {
  const navigate = useNavigate();
  const { user, activeRole } = useAuth();
  const { t } = useT();

  const [toast, setToast] = useState(null);

  const body = (
    <>
      <Card title={t('account.profile.title')}>
        <ProfileForm
          onSaved={() => setToast({ message: t('account.profile.saved'), type: 'success' })}
        />
      </Card>

      <Card title={t('account.pwd.title')}>
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
          <p className="text-xs font-semibold text-slate-400 break-all">
            {user?.email ? t('account.subtitle', { email: user.email }) : ''}
          </p>

          {/*
            Two columns, because every other page inside this shell fills its
            width — ProfilePage on a 12-column grid, both dashboards on their
            own. A single narrow column capped at max-w-2xl left roughly a
            third of the content area empty on the right and nothing on the
            left, which read as a layout bug rather than as a choice.

            `body` is a fragment, and fragments emit no DOM node, so its two
            cards become grid items directly.

            `items-start` because the password card is much the taller of the
            two: without it the profile card would stretch to match and carry a
            gap of dead space under its button.
          */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {body}
          </div>
        </div>
      </>
    );
  }

  /* No role: the signed-in shell cannot be built, so the page carries its own
     frame, its own title and its own way back. homeFor falls through to the
     role picker, which is where somebody in this state belongs. */
  const footer = (
    <button
      type="button"
      onClick={() => navigate(homeFor(activeRole))}
      className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand font-bold transition-colors focus:outline-none focus-visible:text-brand cursor-pointer"
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
          <h1 className="text-3xl sm:text-[34px] font-extrabold text-brand leading-tight select-none">
            {t('account.title')}
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-2 font-semibold break-all">
            {user?.email ? t('account.subtitle', { email: user.email }) : ''}
          </p>
        </div>

        {body}
      </AuthLayout>
    </>
  );
};

export default AccountPage;
