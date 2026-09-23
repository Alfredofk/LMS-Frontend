import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import AuthLayout from '../../layouts/AuthLayout';
import { useAuth } from '../../context/AuthContext';
import Toast from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import {
  ROLES,
  ROLE_LABEL_KEY,
  ROLE_TAGLINE_KEY,
  SELECTABLE_ROLES,
  GET_STARTED_PATH,
  homeFor,
} from '../../constants/roles';
import RejectionNotice from './RejectionNotice';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import { schoolService } from '../../services/schoolService';
import { authService } from '../../services/authService';
import { adminService } from '../../services/adminService';
import { accessTokenClaims } from '../../services/apiClient';

/*
  The one screen between signing in and working.

  It used to be two. This page showed the roles somebody held, and /no-school
  told everybody else that there was nothing for them yet — which meant a newly
  verified account, the commonest kind there is, never saw the three cards at
  all. They are the clearest statement of what this app is, so everyone sees
  them now.

  It also used to lock every card somebody did not already hold, which was the
  deeper mistake: it assumed all three are roles a school grants. Two of them
  are not the same thing at all.

    Organization  registers a NEW school. No school can grant it, because there
                  is no school yet — that is a chicken and an egg, and locking
                  the card leaves a principal with nowhere to begin.
    Student       joins a school that exists, by its School Code.
    Teacher

  So a card is selectable whenever choosing it leads somewhere. Holding the role
  means entering it; not holding it means continuing to /get-started, which says
  what that path will ask for. Only PENDING is unselectable, and only because a
  request is already in flight and the database allows exactly one.
*/

const roleIcons = {
  [ROLES.STUDENT]: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.231-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 017.918 5.841 50.58 50.58 0 00-2.658.814m-13.002 0L12 14.583l8.742-4.436M12 14.583v6.32" />
    </svg>
  ),
  [ROLES.TEACHER]: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  [ROLES.GUARDIAN]: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  [ROLES.PRINCIPAL]: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12v18H3V3z" />
    </svg>
  ),
};

/*
  Sign-in reports roles as bare strings and only the ACTIVE ones; /users/me
  reports objects carrying each role's approval status. Reading either shape here
  means the screen still renders sensibly on a reload that has not reached the
  network yet.
*/
const statusOf = (membership, role) => {
  const entry = (membership?.roles ?? []).find((item) =>
    typeof item === 'string' ? item === role : item.role === role
  );

  if (!entry) return { state: 'NONE', reason: null };
  if (typeof entry === 'string') return { state: 'ACTIVE', reason: null };
  return { state: entry.status, reason: entry.rejectionReason };
};

const CARD_NOTE_KEY = {
  PENDING: 'selectRole.note.pending',
  REJECTED: 'selectRole.note.rejected',
};

/*
  What a card knows about itself, including the one thing memberships cannot say.

  Founding a school is a SchoolRegistration, not a MembershipRole, so
  `statusOf` — which reads `membership.roles` — sees nothing at all while one is
  under review, and the Organization card would offer itself as though the
  applicant had never applied.

  The registration's three statuses map onto the same states the other two cards
  already use, so every badge, note and lock below is reused rather than
  duplicated. APPROVED is deliberately absent: by then the membership carries
  PRINCIPAL and `statusOf` is right again — getting the session to that point is
  what the refresh in `check()` is for.
*/
const REGISTRATION_STATE = {
  PENDING: { state: 'PENDING', noteKey: 'reg.note.pending' },
  REJECTED: { state: 'REJECTED', noteKey: null },
};

const cardStatusOf = (membership, role, registration) => {
  if (role === ROLES.PRINCIPAL && registration) {
    const mapped = REGISTRATION_STATE[registration.status];
    if (mapped) {
      return {
        state: mapped.state,
        reason: registration.rejectionReason ?? null,
        noteKey: mapped.noteKey,
      };
    }
  }

  return { ...statusOf(membership, role), noteKey: null };
};

const STATUS_BADGE = {
  PENDING: 'bg-amber-50 text-amber-600',
  REJECTED: 'bg-red-50 text-red-600',
};


/*
  A card can be chosen unless a request for it is already in flight. PENDING is
  the one dead end: the database allows a single PENDING-or-ACTIVE membership per
  person, so asking twice is not a thing anybody can do.
*/
const isSelectable = (membership, role) => statusOf(membership, role).state !== 'PENDING';

/*
  What Continue should point at before anybody has touched anything: a role they
  already hold, or failing that the first card that leads somewhere. Never null
  while any card is live — a disabled Continue under three clickable cards reads
  as a broken screen.
*/
const defaultChoice = (membership, held) =>
  held[0] ?? SELECTABLE_ROLES.find((role) => isSelectable(membership, role)) ?? null;

export const SelectRolePage = () => {
  const navigate = useNavigate();
  const { user, membership, roles, activeRole, isPlatformAdmin, refreshMe, selectRole, logout } =
    useAuth();
  const { t } = useT();

  /*
    Start from what is already known, so a failed refresh still leaves something
    selected rather than a disabled Continue button and no explanation. The
    refresh below corrects it when it succeeds.
  */
  const [selected, setSelected] = useState(() => activeRole ?? defaultChoice(membership, roles));
  const [isLoading, setIsLoading] = useState(true);
  /*
    Separate from `isLoading`, and only ever set once.

    The cards used to paint immediately from the cached membership while the
    first check was still in flight. For a platform admin that meant seeing
    three roles they cannot hold, and then being moved away — the flash. But it
    was wrong for everybody: the whole reason `check()` exists is that the
    cached membership can be out of date, so those first cards were an answer
    given before the question had been asked.

    "Check again" must not blank the page, so this stays true afterwards.
  */
  const [hasChecked, setHasChecked] = useState(false);
  const [toast, setToast] = useState(null);
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);
  const [registration, setRegistration] = useState(null);

  /*
    Re-read on arrival, and again whenever asked.

    An approval granted since the last sign-in is invisible in the cached
    membership, and this is the one screen where that difference is the whole
    point: somebody waiting on their school sits here until the answer arrives.
  */
  const check = useCallback(
    async ({ announce = false } = {}) => {
      setIsLoading(true);
      try {
        let session = await refreshMe();

        /*
          A separate surface: /users/me reports memberships and knows nothing
          about registrations. A failure here is not fatal — the roles above are
          what this screen is mainly for — so it is swallowed rather than
          replacing them with an error.
        */
        /*
          Both at once. The registration and the platform-admin probe are
          independent, and running them in sequence made the pause before the
          redirect twice as long as it needed to be.
        */
        const noRoles = session.roles.length === 0;
        const [mine, adminProbe] = await Promise.allSettled([
          schoolService.listMyRegistrations(),
          /* A probe: only the status code matters, so ask for one row rather
             than the default page of fifty. */
          noRoles ? adminService.list({ limit: 1 }) : Promise.reject(new Error('skipped')),
        ]);

        const latest =
          mine.status === 'fulfilled' ? (mine.value.registrations?.[0] ?? null) : null;

        /*
          Approved, but this session has not caught up.

          Nothing that grants a role mints a new token. Approving a school
          registration writes the School, the membership and the PRINCIPAL role in
          one transaction (school.service.js:302); releasing a join request writes
          the membership role and touches neither refresh nor access token
          (membership.service.js has no mention of either). Both leave the
          applicant holding a token that still says schoolId: null.

          So `/users/me` reports the role as ACTIVE while the token backing it
          knows no school, and every tenant-scoped route answers 403 — which reads
          as "it was approved and the app is broken", at the exact moment somebody
          was finally let in.

          **The token is asked, not guessed at.** This used to test for an APPROVED
          school registration instead, which was both too narrow and too eager: it
          never fired for a teacher (who has no registration at all), and it fired
          on every later visit even once the token was already correct. Reading the
          claim is exact in both directions — and that matters, because the backend
          rotates the refresh token on every trade and treats an old one coming
          back as theft. Fewer trades is not an optimisation here; it is the safer
          behaviour.
        */
        /* `session.roles` comes from activeRolesOf, which drops any role missing
           from ROLE_HOME — and GUARDIAN is missing, because no guardian screen
           exists to send them to. So an approved guardian will not trade their
           token in here. Unreachable today (nobody can release a GUARDIAN until
           classes exist), and due to become real alongside a guardian dashboard. */
        if (session.roles.length > 0 && !accessTokenClaims()?.schoolId) {
          await authService.refresh();
          session = await refreshMe();
        }

        /*
          A platform admin has no business on this screen.

          They stand above every school: no membership, no SchoolRole, nothing
          to pick. Left alone they would land here and be offered three cards —
          join as a student, join as a teacher, register a school — none of
          which is their job.

          There is no flag to read. `/users/me` answers `publicUser`, which
          carries id, email, fullName, emailVerifiedAt and createdAt and nothing
          about platform admins; the only place that knowledge lives is the
          PlatformAdmin table, which `requirePlatformAdmin` consults on every
          request. So the question is asked the only way it can be — by calling
          an admin route and seeing whether it refuses.

          Only asked when there are no roles at all, which is exactly the case
          this screen cannot serve. Somebody with a school to enter is not
          probed, and pays nothing for this.
        */
        if (noRoles && adminProbe.status === 'fulfilled') {
          /* Returns without clearing `isLoading` or setting `hasChecked`, so
             this screen keeps its loading state for the frame or two before the
             route changes — no flash of cards nobody can use. */
          navigate('/admin/school-registrations', { replace: true });
          return;
        }

        setRegistration(latest);

        setSelected((current) =>
          current && isSelectable(session.membership, current)
            ? current
            : defaultChoice(session.membership, session.roles)
        );

        if (announce && session.roles.length === 0) {
          setToast({ message: t('selectRole.nothingChanged'), type: 'info' });
        }
      } catch (err) {
        setToast({ message: apiErrorMessage(err, t), type: 'error' });
      } finally {
        setIsLoading(false);
        /* Even on failure: a screen that never stops loading is worse than one
           showing what it last knew, with the error beside it. */
        setHasChecked(true);
      }
    },
    [refreshMe, navigate, t]
  );

  useEffect(() => {
    check();
    // Once on arrival; the Check again button covers every look after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
    Continue means two different things, decided by what the chosen card is.
    A role already held is entered; anything else is a path still to be walked,
    and /get-started explains where it leads.
  */
  const handleContinue = () => {
    if (!selected) return;

    if (!roles.includes(selected)) {
      navigate(GET_STARTED_PATH[selected]);
      return;
    }

    if (!selectRole(selected)) {
      setToast({ message: t('selectRole.notAvailable'), type: 'error' });
      return;
    }

    navigate(homeFor(selected), { replace: true });
  };

  /*
    Decided before anything is drawn.

    The answer was learned at sign-in and cached, so a platform admin leaves
    here without this screen ever appearing. Rendering first and redirecting
    afterwards — which is what the probe inside `check()` used to do on its own —
    put the whole purple page on screen and then took it away again.

    `check()` still probes as a fallback, for a session that predates this flag
    or one whose admin rights were granted mid-session.
  */
  if (isPlatformAdmin && roles.length === 0) {
    return <Navigate to="/admin/school-registrations" replace />;
  }

  const hasRoles = roles.length > 0;
  const isPending = membership?.status === 'PENDING';
  const schoolName = membership?.school?.name ?? membership?.schoolName;

  const blurb = hasRoles
    ? t('selectRole.blurb.hasRoles', { school: schoolName })
    : isPending
      ? t('selectRole.blurb.pending')
      : t('selectRole.blurb.fresh');

  /*
    The ways out, and the one way sideways.

    Account & Security belongs here rather than only in the signed-in shell:
    somebody whose school is still PENDING never reaches that shell, and this
    screen is where they wait. It is the only link on this page that leads
    somewhere they can actually use today.
  */
  const footer = (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        onClick={() => navigate('/account')}
        className="text-xs text-slate-500 hover:text-brand font-bold transition-colors focus:outline-none cursor-pointer"
      >
        {t('account.title')}
      </button>
      <span className="text-slate-200 select-none" aria-hidden="true">·</span>
      <button
        type="button"
        onClick={() => setIsSignOutOpen(true)}
        className="text-xs text-slate-500 hover:text-brand font-bold transition-colors focus:outline-none cursor-pointer"
      >
        {t('common.signOut')}
      </button>
    </div>
  );

  return (
    <>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <AuthLayout
        heading={t(hasRoles ? 'selectRole.panel.hasRoles' : isPending ? 'selectRole.panel.pending' : 'selectRole.panel.fresh')}
        blurb={blurb}
        footer={footer}
      >
        <div>
          <h2 className="text-3xl sm:text-[34px] font-extrabold text-brand leading-tight select-none">
            {t('selectRole.title')}
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-2 font-semibold break-all">
            {user?.fullName ? t('selectRole.signedInAs', { name: user.fullName }) : ''}
            {user?.email ? ` · ${user.email}` : ''}
          </p>
        </div>

        {/* Nothing below is decided until the first check answers. Until then
            this stands in for it, rather than the cards guessing from a cache
            that may be a school approval out of date. */}
        {!hasChecked && (
          <div className="space-y-3.5 animate-pulse select-none" aria-label={t('common.loading')}>
            <div className="h-16 bg-white border border-slate-100 rounded-2xl shadow-sm" />
            <div className="h-20 bg-white border border-slate-100 rounded-2xl shadow-sm" />
            <div className="h-20 bg-white border border-slate-100 rounded-2xl shadow-sm" />
            <div className="h-20 bg-white border border-slate-100 rounded-2xl shadow-sm" />
          </div>
        )}

        {/* What the three cards mean for somebody who holds none of them yet —
            the difference between joining a school and starting one is the whole
            point, and three boxes alone do not make it. */}
        {hasChecked && !hasRoles && (
          <div className="border border-slate-200 rounded-2xl p-4 text-left bg-white shadow-sm">
            <p className="text-sm text-slate-600 font-medium leading-relaxed">
              {isPending ? (
                t('selectRole.explain.pending', { school: schoolName })
              ) : (
                <>
                  {/* Three names now, not two. `andLast` carries its own leading
                      punctuation because the two languages disagree about it:
                      Indonesian wants a comma before "dan", English does not. */}
                  <span className="font-extrabold text-slate-800">{t('selectRole.explain.fresh.a')}</span>,{' '}
                  <span className="font-extrabold text-slate-800">{t('selectRole.explain.fresh.b')}</span>
                  {t('selectRole.explain.fresh.andLast')}{' '}
                  <span className="font-extrabold text-slate-800">{t('selectRole.explain.fresh.d')}</span>{' '}
                  {t('selectRole.explain.fresh.middle')}{' '}
                  <span className="font-extrabold text-slate-800">{t('selectRole.explain.fresh.c')}</span>{' '}
                  {t('selectRole.explain.fresh.end')}
                </>
              )}
            </p>
          </div>
        )}

        <div className={`space-y-3.5 ${hasChecked ? '' : 'hidden'}`}>
          {SELECTABLE_ROLES.map((role) => {
            const { state, reason, noteKey } = cardStatusOf(membership, role, registration);
            const selectable = state !== 'PENDING';
            const isSelected = selectable && selected === role;
            const badge = STATUS_BADGE[state];

            /*
              The card's ordinary pitch, in every state.

              A rejection used to replace it with the reviewer's own words, which
              put free text a human typed into the slot where a fixed tagline
              belongs — "Jelek nama sekolahnya" sitting where "Set EduForID up for
              your school" goes reads as a caption, not as a decision about you.
              The reason now gets its own line below, and the dialog says it
              properly on arrival.
            */
            const note = noteKey
              ? t(noteKey)
              : state === 'PENDING'
                ? t(CARD_NOTE_KEY.PENDING)
                : t(ROLE_TAGLINE_KEY[role]);

            return (
              <button
                key={role}
                type="button"
                onClick={() => selectable && setSelected(role)}
                disabled={!selectable || isLoading}
                aria-pressed={isSelected}
                className={`
                  w-full border rounded-2xl p-4 flex items-center justify-between text-left transition-all duration-200 select-none
                  ${isSelected
                    ? 'border-brand border-2 shadow-lg shadow-brand/5 bg-white cursor-pointer'
                    : selectable
                      ? 'border-slate-200 bg-white hover:border-slate-300 cursor-pointer'
                      : 'border-slate-100 bg-slate-50/60 opacity-60 cursor-not-allowed'
                  }
                `}
              >
                <div className="flex items-center min-w-0">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 mr-4 ${
                      selectable ? 'bg-brand-tint text-brand' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {roleIcons[role]}
                  </div>
                  <div className="min-w-0">
                    <h3 className={`text-base font-extrabold ${selectable ? 'text-slate-800' : 'text-slate-500'}`}>
                      {t(ROLE_LABEL_KEY[role])}
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5 break-words">{note}</p>
                    {/* Somebody else's words about this person, so they are marked
                        as a quotation rather than dressed up as our own copy. */}
                    {state === 'REJECTED' && (
                      <p className="mt-1.5 pl-2 border-l-2 border-rose-200 text-[11px] text-rose-600 font-semibold break-words">
                        {reason ?? t(CARD_NOTE_KEY.REJECTED)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {badge && (
                    <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${badge}`}>
                      {t(`selectRole.badge.${state}`)}
                    </span>
                  )}
                  {selectable && (
                    <span className="w-8 h-8 rounded-full border border-brand/20 flex items-center justify-center text-brand text-sm">
                      ➔
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/*
          Continue is always the way forward now, whether that means entering a
          role or starting to ask for one. Check again is a second, quieter
          button and only for somebody whose request is already in flight —
          looking again is genuinely all they can do.
        */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleContinue}
            disabled={!selected || isLoading}
            className="w-full py-3.5 rounded-2xl justify-center font-bold text-base bg-brand hover:bg-brand-deep text-white active:scale-95 transition-transform shadow-lg shadow-brand/20 flex items-center gap-1 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {isLoading ? t('common.loading') : t('common.continue')}
            {!isLoading && (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 mt-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            )}
          </button>

          {isPending && (
            <button
              type="button"
              onClick={() => check({ announce: true })}
              disabled={isLoading}
              className="w-full justify-center border border-slate-200 py-3 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm text-slate-700 font-semibold text-sm flex items-center gap-2 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? t('common.checking') : t('selectRole.checkAgain')}
            </button>
          )}
        </div>
      </AuthLayout>

      {/*
        Being turned down, said once and properly, instead of left as small grey
        text on a card. It decides for itself whether there is anything to say and
        renders nothing when there is not — which is almost always.
      */}
      <RejectionNotice membership={membership} registration={registration} />

      {/* The sign-out here is a small text link in the footer, easy to hit by
          accident. It asks first, like the sidebar's does. */}
      <ConfirmDialog
        open={isSignOutOpen}
        title={t('confirm.logOut.title')}
        body={t('confirm.logOut.body')}
        confirmLabel={t('shell.logOut')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setIsSignOutOpen(false)}
        onConfirm={async () => {
          await logout();
          navigate('/login', { replace: true });
        }}
      />
    </>
  );
};

export default SelectRolePage;
