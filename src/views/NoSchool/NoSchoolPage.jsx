import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import Toast from '../../components/ui/Toast';
import { ROLE_LABEL, homeFor } from '../../constants/roles';

/*
  Where somebody lands when they are signed in and there is nothing yet for them
  to open.

  Two different situations share this screen, and the difference matters to the
  person standing in front of it:

    membership === null      they belong to no school at all
    membership.status PENDING they asked to join one and nobody has answered

  Neither is an error. A token issued to either carries no school, so every
  school-owned query it could make would be refused by design — which is exactly
  why this page calls nothing but /users/me. Sending it at a dashboard would fill
  the screen with failures and blame the person for them.
*/

const STATUS_BADGE = {
  ACTIVE: 'bg-emerald-50 text-emerald-600',
  PENDING: 'bg-amber-50 text-amber-600',
  REJECTED: 'bg-red-50 text-red-600',
};

export const NoSchoolPage = () => {
  const navigate = useNavigate();
  const { user, membership, refreshMe, logout } = useAuth();

  const [isChecking, setIsChecking] = useState(true);
  const [toast, setToast] = useState(null);

  /*
    Approval happens somewhere else, on somebody else's schedule. Re-reading
    /users/me is the only way this screen ever learns that it is no longer the
    right screen, so it does that on arrival and whenever asked.
  */
  const check = useCallback(
    async ({ announce = false } = {}) => {
      setIsChecking(true);
      try {
        const session = await refreshMe();

        if (session.roles.length > 0) {
          navigate(session.activeRole ? homeFor(session.activeRole) : '/select-role', {
            replace: true,
          });
          return;
        }

        if (announce) {
          setToast({ message: 'Nothing has changed yet. Try again later.', type: 'info' });
        }
      } catch (err) {
        setToast({ message: err.message || 'Could not check your status.', type: 'error' });
      } finally {
        setIsChecking(false);
      }
    },
    [refreshMe, navigate]
  );

  useEffect(() => {
    check();
    // Once on arrival; the button covers every check after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPending = membership?.status === 'PENDING';
  const schoolName = membership?.school?.name ?? membership?.schoolName;
  const requestedRoles = membership?.roles ?? [];

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
            {isPending ? 'Almost There' : 'One Step to Go'}
          </h2>
          <p className="text-sm sm:text-base text-violet-100/90 leading-relaxed font-medium">
            {isPending
              ? 'Your request has been sent. A school can only be joined once somebody there approves it.'
              : 'Your account is ready. It just needs a school before there is anything to open.'}
          </p>
        </div>

        {/* Hidden below lg: stacked on a phone the purple panel is a short band,
            and a white disc behind white copy simply erases it. */}
        <div className="hidden lg:block absolute bottom-[-130px] left-[-130px] w-64 h-64 rounded-full bg-white pointer-events-none" />
      </div>

      {/* --- WHITE CARD COLUMN --- */}
      <div className="w-full bg-white min-h-screen lg:h-full lg:overflow-y-auto flex flex-col justify-between p-6 sm:p-8 lg:py-8 lg:px-12 relative shrink-0 z-10 shadow-2xl lg:w-[65%] lg:order-2 lg:rounded-l-[48px] lg:rounded-r-none">

        <div className="absolute top-0 left-0 w-28 h-28 bg-[#6D43EC] rounded-br-full pointer-events-none" />
        <div className="absolute top-10 left-36 w-3 h-3 bg-[#6D43EC] rounded-full opacity-60 pointer-events-none" />
        <div className="absolute top-1/4 left-[-16px] w-12 h-12 bg-[#ECE9FE] rounded-full pointer-events-none" />
        <div className="absolute top-16 right-10 w-14 h-14 bg-[#ECE9FE] rounded-full pointer-events-none opacity-80" />

        <div className="h-[40px] z-10 shrink-0" />

        <div className="my-auto w-full z-10 py-2 shrink-0">
          <div className="w-full max-w-[420px] mx-auto text-center space-y-6">

            <div className="w-16 h-16 bg-[#F1EEFF] rounded-2xl flex items-center justify-center text-[#7047EB] mx-auto shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                {isPending ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12v18H3V3z" />
                )}
              </svg>
            </div>

            <div>
              <h1 className="text-3xl sm:text-[34px] font-extrabold text-[#7047EB] leading-tight select-none">
                {isPending ? 'Waiting for approval' : 'No school yet'}
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-2 font-semibold">
                {user?.fullName ? `Signed in as ${user.fullName}` : 'You are signed in'}
                {user?.email ? ` · ${user.email}` : ''}
              </p>
            </div>

            {isPending ? (
              <div className="border border-slate-200 rounded-2xl p-5 text-left space-y-4 bg-white shadow-sm">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">School</span>
                  <p className="text-base font-extrabold text-slate-800 mt-0.5">{schoolName}</p>
                </div>

                {requestedRoles.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Roles requested
                    </span>
                    <ul className="mt-2 space-y-1.5">
                      {requestedRoles.map((entry) => {
                        const role = typeof entry === 'string' ? entry : entry.role;
                        const status = typeof entry === 'string' ? 'ACTIVE' : entry.status;
                        const reason = typeof entry === 'string' ? null : entry.rejectionReason;

                        return (
                          <li key={role} className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <span className="text-sm font-bold text-slate-700">
                                {ROLE_LABEL[role] ?? role}
                              </span>
                              {status === 'REJECTED' && reason && (
                                <p className="text-xs text-slate-400 font-medium break-words">{reason}</p>
                              )}
                            </div>
                            <span
                              className={`text-[9px] font-bold px-2 py-1 rounded-full shrink-0 ${
                                STATUS_BADGE[status] ?? 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              {status}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  Nothing more is needed from you. This page updates itself once somebody at the
                  school answers.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl p-5 text-left bg-white shadow-sm">
                <p className="text-sm text-slate-600 font-medium leading-relaxed">
                  Your account works, but it is not attached to a school. Roles — student, teacher,
                  organization — are granted by a school, so until you belong to one there is
                  nothing here to open.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => check({ announce: true })}
              disabled={isChecking}
              className="w-full py-3.5 rounded-2xl justify-center font-bold text-base bg-[#7047EB] hover:bg-[#5E3BD2] text-white active:scale-95 transition-transform shadow-lg shadow-[#7047EB]/20 flex items-center gap-2 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {isChecking ? 'Checking…' : 'Check again'}
            </button>
          </div>
        </div>

        {/* Bottom Footer Section */}
        <div className="mt-4 z-10 text-center space-y-3 shrink-0">
          {!isPending && (
            <div className="text-sm text-slate-500 select-none">
              <div className="flex items-center justify-center gap-3 mb-3">
                <span className="h-px bg-slate-100 flex-1" />
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">or</span>
                <span className="h-px bg-slate-100 flex-1" />
              </div>
              <p className="font-semibold">
                Have an invitation code?{' '}
                <button
                  type="button"
                  /* Still a stub: the backend has no join-a-school endpoint yet,
                     so there is nowhere to send a code. */
                  onClick={() =>
                    setToast({
                      message: 'Joining a school is not available yet. Ask your school to add you.',
                      type: 'info',
                    })
                  }
                  className="text-[#7047EB] hover:underline font-extrabold focus:outline-none cursor-pointer"
                >
                  Join your school
                </button>
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
            className="text-xs text-slate-400 hover:text-[#7047EB] font-bold transition-colors focus:outline-none cursor-pointer"
          >
            Sign out
          </button>
        </div>

      </div>

    </div>
  );
};

export default NoSchoolPage;
