import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import Toast from '../../components/ui/Toast';
import {
  ROLES,
  ROLE_LABEL,
  ROLE_TAGLINE,
  SELECTABLE_ROLES,
  homeFor,
} from '../../constants/roles';

/*
  The "Get Started" screen, moved here from /login and given something real to do.

  Before, it asked which role somebody wanted before they had an account, and the
  answer went nowhere — registration does not take a role. Here it asks which of
  the roles they have been granted they want to work as, which is a question the
  server can actually answer.

  All three cards stay on screen whether or not they are held. A card that is
  simply missing teaches nothing; a card that says "waiting for approval", or why
  it was refused, tells somebody exactly where they stand.
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

const CARD_NOTE = {
  ACTIVE: null,
  PENDING: 'Waiting for your school to approve this',
  REJECTED: 'Your school did not approve this',
  NONE: 'You have not been given this access',
};

export const SelectRolePage = () => {
  const navigate = useNavigate();
  const { membership, roles, activeRole, refreshMe, selectRole } = useAuth();

  /*
    Start from what is already known, so a failed refresh still leaves something
    selected rather than a disabled Continue button and no explanation. The
    refresh below corrects it when it succeeds.
  */
  const [selected, setSelected] = useState(() => activeRole ?? roles[0] ?? null);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);

  /*
    Always re-read on arrival. An approval granted since the last sign-in is
    invisible in the cached membership, and this is the one screen where that
    difference is the whole point.
  */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const session = await refreshMe();
        if (cancelled) return;

        if (session.roles.length === 0) {
          navigate('/no-school', { replace: true });
          return;
        }

        setSelected((current) =>
          current && session.roles.includes(current) ? current : session.roles[0]
        );
      } catch (err) {
        if (!cancelled) {
          setToast({ message: err.message || 'Could not load your roles.', type: 'error' });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Runs once on arrival: refreshMe changes identity whenever activeRole does,
    // and re-running on that would fight the selection being made here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinue = () => {
    if (!selected) return;

    if (!selectRole(selected)) {
      setToast({ message: 'That role is not available on your account.', type: 'error' });
      return;
    }

    navigate(homeFor(selected), { replace: true });
  };

  const schoolName = membership?.school?.name ?? membership?.schoolName;

  return (
    <div className="min-h-screen lg:h-screen w-screen bg-[#6D43EC] flex flex-col lg:flex-row font-sans selection:bg-violet-500 selection:text-white relative lg:overflow-hidden">

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* --- PURPLE SIDEBAR COLUMN --- */}
      <div className="w-full text-white flex flex-col justify-between p-8 sm:p-12 relative shrink-0 z-0 text-left select-none bg-[#6D43EC] lg:w-[35%] lg:h-full lg:order-1 lg:overflow-hidden">
        <div className="text-2xl font-black tracking-tight text-left">
          MikeKwok
        </div>

        <div className="relative my-auto space-y-6 max-w-sm z-10 shrink-0">
          <h2 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight">
            Smarter Learning Starts Here
          </h2>
          <p className="text-sm sm:text-base text-violet-100/90 leading-relaxed font-medium">
            {schoolName
              ? `You are signed in at ${schoolName}. Choose how you want to continue.`
              : 'Manage, track, and improve learning with an all-in-one platform designed for schools, teachers, and students.'}
          </p>
        </div>

        {/* Hidden below lg: stacked on a phone the purple panel is a short band,
            and a white disc behind white copy simply erases it. */}
        <div className="hidden lg:block absolute bottom-[-130px] left-[-130px] w-64 h-64 rounded-full bg-white pointer-events-none" />
      </div>

      {/* --- WHITE CARD COLUMN --- */}
      <div className="w-full bg-white min-h-screen lg:h-full lg:overflow-y-auto flex flex-col justify-between p-6 sm:p-8 lg:py-8 lg:px-12 relative shrink-0 z-10 shadow-2xl lg:w-[65%] lg:order-2 lg:rounded-l-[48px] lg:rounded-r-none">

        {/* Decorative Shapes inside White Card */}
        <div className="absolute top-0 left-0 w-28 h-28 bg-[#6D43EC] rounded-br-full pointer-events-none" />
        <div className="absolute top-10 left-36 w-3 h-3 bg-[#6D43EC] rounded-full opacity-60 pointer-events-none" />
        <div className="absolute top-1/4 left-[-16px] w-12 h-12 bg-[#ECE9FE] rounded-full pointer-events-none" />
        <div className="absolute top-16 right-10 w-14 h-14 bg-[#ECE9FE] rounded-full pointer-events-none opacity-80" />

        <div className="h-[40px] z-10 shrink-0" />

        <div className="my-auto w-full z-10 py-2 shrink-0">
          <div className="w-full max-w-[420px] mx-auto text-center space-y-6">
            <div>
              <h1 className="text-3xl sm:text-[34px] font-extrabold text-[#7047EB] leading-tight select-none">
                Get Started
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-2 font-semibold select-none">
                Choose how you want to use MikeKwok
              </p>
            </div>

            <div className="space-y-3.5">
              {SELECTABLE_ROLES.map((role) => {
                const { state, reason } = statusOf(membership, role);
                const available = state === 'ACTIVE';
                const isSelected = available && selected === role;
                const note = state === 'REJECTED' && reason ? reason : CARD_NOTE[state];

                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => available && setSelected(role)}
                    disabled={!available || isLoading}
                    aria-pressed={isSelected}
                    className={`
                      w-full border rounded-2xl p-4 flex items-center justify-between text-left transition-all duration-200 select-none
                      ${isSelected
                        ? 'border-[#7047EB] border-2 shadow-lg shadow-[#7047EB]/5 bg-white cursor-pointer'
                        : available
                          ? 'border-slate-200 bg-white hover:border-slate-300 cursor-pointer'
                          : 'border-slate-100 bg-slate-50/60 opacity-60 cursor-not-allowed'
                      }
                    `}
                  >
                    <div className="flex items-center min-w-0">
                      <div
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 mr-4 ${
                          available ? 'bg-[#F1EEFF] text-[#7047EB]' : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {roleIcons[role]}
                      </div>
                      <div className="min-w-0">
                        <h3 className={`text-base font-extrabold ${available ? 'text-slate-800' : 'text-slate-500'}`}>
                          {ROLE_LABEL[role]}
                        </h3>
                        <p className="text-xs text-slate-400 font-semibold mt-0.5 break-words">
                          {available ? ROLE_TAGLINE[role] : note}
                        </p>
                      </div>
                    </div>

                    {available ? (
                      <span className="w-8 h-8 rounded-full border border-[#7047EB]/20 flex items-center justify-center text-[#7047EB] text-sm shrink-0">
                        ➔
                      </span>
                    ) : (
                      <span
                        className={`text-[9px] font-bold px-2 py-1 rounded-full shrink-0 ml-2 ${
                          state === 'PENDING'
                            ? 'bg-amber-50 text-amber-600'
                            : state === 'REJECTED'
                              ? 'bg-red-50 text-red-600'
                              : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {state === 'PENDING' ? 'PENDING' : state === 'REJECTED' ? 'REJECTED' : 'LOCKED'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleContinue}
              disabled={!selected || isLoading}
              className="w-full py-3.5 rounded-2xl justify-center font-bold text-base bg-[#7047EB] hover:bg-[#5E3BD2] text-white active:scale-95 transition-transform shadow-lg shadow-[#7047EB]/20 flex items-center gap-1 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {isLoading ? 'Loading…' : 'Continue'}
              {!isLoading && (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 mt-0.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Bottom Footer Section */}
        <div className="mt-4 z-10 text-center space-y-3 shrink-0">
          <div className="text-sm text-slate-500 select-none">
            <div className="flex items-center justify-center gap-3 mb-3">
              <span className="h-px bg-slate-100 flex-1" />
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">or</span>
              <span className="h-px bg-slate-100 flex-1" />
            </div>
            <p className="font-semibold">
              Need access you do not have?{' '}
              <button
                type="button"
                onClick={() => navigate('/no-school')}
                className="text-[#7047EB] hover:underline font-extrabold focus:outline-none cursor-pointer"
              >
                Join your school
              </button>
            </p>
          </div>
        </div>

      </div>

    </div>
  );
};

export default SelectRolePage;
