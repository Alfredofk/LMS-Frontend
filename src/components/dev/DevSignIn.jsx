import React from 'react';

import { activeStore } from '../../services/apiClient';
import { ROLES, ROLE_HOME } from '../../constants/roles';
import { useT } from '../../i18n/LanguageContext';

/*
  A way into the app while there is no way into the app.

  Reaching any signed-in screen needs an ACTIVE membership with an ACTIVE role,
  and the only thing that could grant one is the join-school endpoint, which the
  backend has not written (ticket 05). So every dashboard in this project is
  currently unreachable by any real account — not just by a test account.

  The workaround until now was pasting five lines into the devtools console,
  which logging out wipes. This is that paste, as a button.

  ## It cannot reach production

  `import.meta.env.DEV` is substituted at build time — Vite writes `false` into
  the bundle, so the early return becomes unconditional and Rollup drops
  everything after it, imports included. Verified by grepping `dist/` for the
  strings below after a build; if you change this file, check again.

  ## What it writes

  Exactly what `AuthContext` writes on a real sign-in, through the same
  `activeStore()`, so the session lands wherever "Remember me" would have put it
  rather than in whichever store this file guessed.

  It keeps a real `lms_user` if one is already there, so signing in properly
  first and then pressing a button here shows your own name.

  ## Delete this when ticket 05 lands
*/

/* Only the three roles that have a dashboard. GUARDIAN has no page. */
const SEEDABLE = [ROLES.STUDENT, ROLES.TEACHER, ROLES.PRINCIPAL];

/*
  This sentence lives here rather than in the dictionaries on purpose. `id.js`
  and `en.js` ship in every build whether or not anything reads them, so a key
  here would be the one part of this tool that survived into production —
  measured: `dev.why` was findable in `dist/` until it moved into this file.

  The role names still come from `t()`, because those keys are ones the app
  itself uses.
*/
const WHY = {
  id: 'Alur gabung sekolah belum ada di backend, jadi belum ada akun mana pun yang punya peran aktif. Masuk langsung sebagai:',
  en: 'The join-school flow does not exist in the backend yet, so no account has an active role. Enter directly as:',
};

const SAMPLE_USER = {
  id: 'dev-user',
  fullName: 'Siti Rahma',
  email: 'siti@contoh.sch.id',
};

const SAMPLE_SCHOOL = {
  id: 'dev-school',
  name: 'SMA Negeri 1 Contoh',
  schoolType: 'SMA',
};

export const DevSignIn = () => {
  const { t, lang } = useT();

  if (!import.meta.env.DEV) return null;

  const enter = (role) => {
    const store = activeStore();

    if (!store.getItem('lms_user')) {
      store.setItem('lms_user', JSON.stringify(SAMPLE_USER));
    }

    store.setItem(
      'lms_membership',
      JSON.stringify({
        id: 'dev-membership',
        status: 'ACTIVE',
        school: SAMPLE_SCHOOL,
        roles: [{ role, status: 'ACTIVE' }],
      })
    );

    /* Written raw, not as JSON — AuthContext reads this one with readRaw. */
    store.setItem('lms_active_role', role);

    /* A full load rather than a client-side navigation: AuthProvider reads
       storage once, when it mounts. `assign` rather than setting `href`, which
       the lint rules read as writing to a variable from outside the component. */
    window.location.assign(ROLE_HOME[role] ?? '/dashboard');
  };

  return (
    <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3 text-left">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        dev only · npm run dev
      </p>
      <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">
        {WHY[lang] ?? WHY.en}
      </p>

      <div className="mt-2.5 flex flex-wrap gap-2">
        {SEEDABLE.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => enter(role)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 transition-colors hover:border-brand hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer"
          >
            {t(`roleTitle.${role}`)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default DevSignIn;
