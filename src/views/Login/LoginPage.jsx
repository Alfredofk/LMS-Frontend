import React from 'react';
import useLoginForm from '../../hooks/useLoginForm';
import LoginForm from './LoginForm';
import Toast from '../../components/ui/Toast';

export const LoginPage = () => {
  const formState = useLoginForm();
  const { 
    authStep,
    setAuthStep,
    activeRole, 
    setActiveRole, 
    toast,
    showToast,
    closeToast,
    resetForm
  } = formState;

  // Handles moving to sign-up from role selection
  const handleRoleContinue = () => {
    setAuthStep('sign_up');
  };

  // Handles clicking "Sign In" from role selection footer
  const handleRoleSignIn = () => {
    setAuthStep('sign_in');
  };

  // Inline Role Icons for Get Started cards
  const roleIcons = {
    student: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.231-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 017.918 5.841 50.58 50.58 0 00-2.658.814m-13.002 0L12 14.583l8.742-4.436M12 14.583v6.32" />
      </svg>
    ),
    teacher: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    headmaster: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12v18H3V3z" />
      </svg>
    )
  };

  const isRolePage = authStep === 'role_selection';

  // Get dynamic sidebar descriptions matching screenshot details
  const getBrandingInfo = () => {
    const isSignUp = authStep === 'sign_up';
    if (isSignUp) {
      switch (activeRole) {
        case 'headmaster':
          return {
            heading: 'Create your organization account',
            bullets: [
              'Access all your schools in one place',
              'Track institutional progress easily',
              'Get customized school administration report',
            ]
          };
        case 'teacher':
          return {
            heading: 'Create your teacher account',
            bullets: [
              'Manage your classes and modules easily',
              'Track your students progress and grades',
              'Create engaging assignments and quizzes',
            ]
          };
        case 'student':
        default:
          return {
            heading: 'Create your student account',
            bullets: [
              'Access all your classes in one place',
              'Track your learning progress easily',
              'Get personalized recommendation',
            ]
          };
      }
    } else {
      // Sign In mode
      switch (activeRole) {
        case 'headmaster':
          return {
            heading: 'Sign in to your organization',
            bullets: [
              'Access all your schools in one place',
              'Track institutional progress easily',
              'Get customized school administration report',
            ]
          };
        case 'teacher':
          return {
            heading: 'Sign in to your teacher dashboard',
            bullets: [
              'Manage your classes and modules easily',
              'Track your students progress and grades',
              'Create engaging assignments and quizzes',
            ]
          };
        case 'student':
        default:
          return {
            heading: 'Sign in to your student portal',
            bullets: [
              'Access all your classes in one place',
              'Track your learning progress easily',
              'Get personalized recommendation',
            ]
          };
      }
    }
  };

  const branding = getBrandingInfo();

  return (
    <div className="min-h-screen lg:h-screen w-screen bg-[#6D43EC] flex flex-col lg:flex-row font-sans selection:bg-violet-500 selection:text-white relative lg:overflow-hidden">
      
      {/* Toast Alert Notifier container */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}

      {/* --- PURPLE SIDEBAR COLUMN (Swaps order and positions based on isRolePage) --- */}
      <div 
        className={`
          w-full text-white flex flex-col justify-between p-8 sm:p-12 relative shrink-0 z-0 text-left select-none bg-[#6D43EC]
          ${isRolePage 
            ? 'lg:w-[35%] lg:h-full lg:order-1 lg:overflow-hidden' 
            : 'hidden lg:flex lg:w-[38%] lg:h-full lg:order-2 lg:overflow-hidden'
          }
        `}
      >
        {/* Top Logo - Placed top-left on role page, top-right on form page */}
        <div className={`text-2xl font-black tracking-tight ${isRolePage ? 'text-left' : 'text-right'}`}>
          LMS
        </div>

        {/* Dynamic Marketing Content in Center */}
        {isRolePage ? (
          /* Role landing marketing */
          <div className="my-auto space-y-6 max-w-sm z-10 shrink-0">
            <h2 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight">
              Smarter Learning Starts Here
            </h2>
            <p className="text-sm sm:text-base text-violet-100/90 leading-relaxed font-medium">
              Manage, track, and improve learning with an all-in-one LMS solution designed for schools, teachers, and students.
            </p>
          </div>
        ) : (
          /* Forms marketing (checkmark list matching screenshots) */
          <div className="my-auto space-y-6 max-w-sm ml-0 lg:ml-auto text-left lg:text-right pr-0 lg:pr-4 z-10 shrink-0">
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight">
              {branding.heading}
            </h2>

            <ul className="space-y-4">
              {branding.bullets.map((bullet, idx) => (
                <li 
                  key={idx} 
                  className="flex lg:flex-row-reverse items-start gap-3 text-violet-100 text-sm font-medium leading-relaxed"
                >
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5 shadow-sm text-white font-bold text-xs select-none">
                    ✓
                  </span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Bottom copyright */}
        <div className={`text-xs text-violet-200/50 mt-12 lg:mt-0 z-10 shrink-0 ${isRolePage ? 'text-left' : 'text-right'}`}>
          © 2026 LMS Platform. All rights reserved.
        </div>

        {/* Decorative elements: white circle arc */}
        {isRolePage ? (
          /* Placed bottom-left on role page */
          <div className="absolute bottom-[-130px] left-[-130px] w-64 h-64 rounded-full bg-white pointer-events-none opacity-100" />
        ) : (
          /* Placed bottom-right on form page (matching SS) */
          <>
            <div className="absolute bottom-[-130px] right-[-130px] w-64 h-64 rounded-full bg-white pointer-events-none opacity-100" />
            <div className="absolute bottom-16 right-16 flex flex-col gap-2.5 pointer-events-none select-none">
              <div className="w-4 h-7 bg-white/20 rounded-full transform -rotate-45" />
              <div className="w-4 h-7 bg-white/20 rounded-full transform -rotate-45" />
              <div className="w-4 h-7 bg-white/20 rounded-full transform -rotate-45" />
            </div>
          </>
        )}
      </div>

      {/* --- WHITE FORM CONTAINER (Swaps order, rounded corners and widths) --- */}
      <div 
        className={`
          w-full bg-white min-h-screen lg:h-full lg:overflow-y-auto flex flex-col justify-between p-6 sm:p-8 lg:py-8 lg:px-12 relative shrink-0 z-10 shadow-2xl
          ${isRolePage 
            ? 'lg:w-[65%] lg:order-2 lg:rounded-l-[48px] lg:rounded-r-none' 
            : 'lg:w-[62%] lg:order-1 lg:rounded-r-[48px] lg:rounded-l-none'
          }
        `}
      >
        {/* Decorative Shapes inside White Card (Matching SS layout) */}
        <div className="absolute top-0 left-0 w-28 h-28 bg-[#6D43EC] rounded-br-full pointer-events-none" />
        <div className="absolute top-10 left-36 w-3 h-3 bg-[#6D43EC] rounded-full opacity-60 pointer-events-none" />
        <div className="absolute top-1/4 left-[-16px] w-12 h-12 bg-[#ECE9FE] rounded-full pointer-events-none" />
        <div className="absolute top-16 right-10 w-14 h-14 bg-[#ECE9FE] rounded-full pointer-events-none opacity-80" />

        {/* Top Back Navigation (Visible only in signup/signin steps) - Placed absolute top-left */}
        {!isRolePage && (
          <div className="absolute top-6 left-6 sm:left-12 z-20">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setAuthStep('role_selection');
              }}
              className="group flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-400 hover:text-[#7047EB] transition-colors focus:outline-none focus:text-[#7047EB] cursor-pointer"
              aria-label="Back to role selection"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 transition-transform group-hover:-translate-x-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Back
            </button>
          </div>
        )}

        {/* Spacer to balance vertical height */}
        <div className="h-[40px] z-10 shrink-0" />

        {/* Card Content Switcher */}
        <div className="my-auto w-full z-10 py-2 shrink-0">
          {isRolePage ? (
            /* ========================================================================= */
            /* ======================== GET STARTED / ROLE PAGE ======================== */
            /* ========================================================================= */
            <div className="w-full max-w-[420px] mx-auto text-center space-y-6">
              <div>
                <h1 className="text-3xl sm:text-[34px] font-extrabold text-[#7047EB] leading-tight select-none">
                  Get Started
                </h1>
                <p className="text-slate-400 text-xs sm:text-sm mt-2 font-semibold select-none">
                  Choose how you want to use LMS
                </p>
              </div>

              {/* Role cards list stack */}
              <div className="space-y-3.5">
                
                {/* Student Card */}
                <div
                  onClick={() => setActiveRole('student')}
                  className={`
                    border rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all duration-200 select-none
                    ${activeRole === 'student' 
                      ? 'border-[#7047EB] border-2 shadow-lg shadow-[#7047EB]/5 bg-white' 
                      : 'border-slate-200 bg-white hover:border-slate-300'
                    }
                  `}
                >
                  <div className="flex items-center text-left">
                    <div className="w-14 h-14 bg-[#F1EEFF] text-[#7047EB] rounded-2xl flex items-center justify-center shrink-0 mr-4">
                      {roleIcons.student}
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-800">Student</h3>
                      <p className="text-xs text-slate-400 font-semibold mt-0.5">Join a class and start learning</p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full border border-[#7047EB]/20 flex items-center justify-center text-[#7047EB] text-sm shrink-0">
                    ➔
                  </div>
                </div>

                {/* Teacher Card */}
                <div
                  onClick={() => setActiveRole('teacher')}
                  className={`
                    border rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all duration-200 select-none
                    ${activeRole === 'teacher' 
                      ? 'border-[#7047EB] border-2 shadow-lg shadow-[#7047EB]/5 bg-white' 
                      : 'border-slate-200 bg-white hover:border-slate-300'
                    }
                  `}
                >
                  <div className="flex items-center text-left">
                    <div className="w-14 h-14 bg-[#F1EEFF] text-[#7047EB] rounded-2xl flex items-center justify-center shrink-0 mr-4">
                      {roleIcons.teacher}
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-800">Teacher</h3>
                      <p className="text-xs text-slate-400 font-semibold mt-0.5">Create and manage your courses</p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full border border-[#7047EB]/20 flex items-center justify-center text-[#7047EB] text-sm shrink-0">
                    ➔
                  </div>
                </div>

                {/* Organization Card */}
                <div
                  onClick={() => setActiveRole('headmaster')}
                  className={`
                    border rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all duration-200 select-none
                    ${activeRole === 'headmaster' 
                      ? 'border-[#7047EB] border-2 shadow-lg shadow-[#7047EB]/5 bg-white' 
                      : 'border-slate-200 bg-white hover:border-slate-300'
                    }
                  `}
                >
                  <div className="flex items-center text-left">
                    <div className="w-14 h-14 bg-[#F1EEFF] text-[#7047EB] rounded-2xl flex items-center justify-center shrink-0 mr-4">
                      {roleIcons.headmaster}
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-800">Organization</h3>
                      <p className="text-xs text-slate-400 font-semibold mt-0.5">Set up LMS for your school</p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full border border-[#7047EB]/20 flex items-center justify-center text-[#7047EB] text-sm shrink-0">
                    ➔
                  </div>
                </div>

              </div>

              {/* Continue button */}
              <button
                type="button"
                onClick={handleRoleContinue}
                className="w-full py-3.5 rounded-2xl justify-center font-bold text-base bg-[#7047EB] hover:bg-[#5E3BD2] text-white active:scale-95 transition-transform shadow-lg shadow-[#7047EB]/20 flex items-center gap-1 select-none cursor-pointer"
              >
                Continue
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 mt-0.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>

              {/* Footer Switcher */}
              <p className="text-sm text-slate-500 font-semibold select-none pt-2">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={handleRoleSignIn}
                  className="text-[#7047EB] hover:text-[#5E3BD2] hover:underline font-extrabold focus:outline-none cursor-pointer"
                >
                  Sign in
                </button>
              </p>
            </div>
          ) : (
            /* ========================================================================= */
            /* ======================== SIGN UP / SIGN IN FORMS ======================== */
            /* ========================================================================= */
            <LoginForm formState={formState} />
          )}
        </div>

        {/* Bottom Footer Section */}
        <div className="mt-4 z-10 text-center space-y-3 shrink-0">
          {!isRolePage && (
            <p className="text-sm text-slate-500 font-semibold select-none">
              {authStep === 'sign_up' ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => setAuthStep(authStep === 'sign_up' ? 'sign_in' : 'sign_up')}
                className="text-[#7047EB] hover:text-[#5E3BD2] hover:underline font-extrabold focus:outline-none focus:underline cursor-pointer"
              >
                {authStep === 'sign_up' ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          )}

          {isRolePage && (
            <div className="text-sm text-slate-500 select-none">
              <div className="flex items-center justify-center gap-3 mb-3">
                <span className="h-px bg-slate-100 flex-1"></span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">or</span>
                <span className="h-px bg-slate-100 flex-1"></span>
              </div>
              <p className="font-semibold">
                Have an invitation code?{' '}
                <button
                  type="button"
                  onClick={() => showToast('Invitation code entry feature is under construction.', 'info')}
                  className="text-[#7047EB] hover:underline font-extrabold focus:outline-none cursor-pointer"
                >
                  Join your school
                </button>
              </p>
            </div>
          )}

          <div className="text-[11px] text-slate-400 select-none">
            By clicking button above, you agree to our{' '}
            <a href="#terms" className="text-[#7047EB] hover:underline font-bold">terms of use</a>{' '}
            and{' '}
            <a href="#privacy" className="text-[#7047EB] hover:underline font-bold">privacy policies</a>
          </div>
        </div>

      </div>

    </div>
  );
};

export default LoginPage;
