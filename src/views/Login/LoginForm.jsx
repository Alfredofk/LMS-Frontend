import React from 'react';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export const LoginForm = ({ formState }) => {
  const {
    authStep,
    activeRole,
    teacherMethod,
    setTeacherMethod,
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    npsn,
    setNpsn,
    loginPassword,
    setLoginPassword,
    schoolCode,
    setSchoolCode,
    username,
    setUsername,
    errors,
    isLoading,
    showToast,
    handleAuthSubmit,
    handleGoogleAuth,
  } = formState;

  const isSignUp = authStep === 'sign_up';

  // Icons matching screenshots
  const icons = {
    user: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-[#8F7CFF]">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
    email: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-[#8F7CFF]">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
    lock: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-[#8F7CFF]">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v-6.75a2.25 2.25 0 002.25-2.25z" />
      </svg>
    ),
    schoolCode: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-[#8F7CFF]">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
    ),
    google: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
    facebook: (
      <svg fill="currentColor" viewBox="0 0 24 24" className="w-6 h-6 text-[#1877F2]">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    apple: (
      <svg fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5 text-slate-900">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.2.67-2.92 1.51-.62.73-1.16 1.87-1.01 2.98 1.1.08 2.23-.62 2.94-1.43z" />
      </svg>
    )
  };

  // Switch role square header icons (lavender square matching)
  const getHeaderIcon = () => {
    const wrapperStyle = "w-16 h-16 bg-[#F1EEFF] rounded-2xl flex items-center justify-center text-[#7047EB] mb-5 mx-auto shadow-sm";
    switch (activeRole) {
      case 'headmaster':
        return (
          <div className={wrapperStyle}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12v18H3V3z" />
            </svg>
          </div>
        );
      case 'teacher':
        return (
          <div className={wrapperStyle}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
        );
      case 'student':
      default:
        return (
          <div className={wrapperStyle}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.231-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 017.918 5.841 50.58 50.58 0 00-2.658.814m-13.002 0L12 14.583l8.742-4.436M12 14.583v6.32" />
            </svg>
          </div>
        );
    }
  };

  const getRoleTitle = () => {
    switch (activeRole) {
      case 'headmaster': return 'Organization';
      case 'teacher': return 'Teacher';
      case 'student':
      default: return 'Student';
    }
  };

  return (
    <div className="w-full max-w-[420px] mx-auto text-center">
      {/* Top Lavender Block Icon */}
      {getHeaderIcon()}

      {/* Dynamic Title exactly styled like screenshot */}
      <h1 className="text-[26px] font-extrabold text-slate-800 leading-tight select-none">
        {isSignUp ? 'Sign Up' : 'Sign In'} as a{' '}
        <span className="text-[#7047EB]">{getRoleTitle()}</span>
      </h1>
      <p className="text-slate-400 text-sm mt-2 mb-8 font-medium select-none">
        Start your journey with LMS
      </p>

      {errors.global && (
        <div className="mb-5 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl text-sm text-red-700 text-left flex items-start gap-2.5 shadow-sm" role="alert">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span>{errors.global}</span>
        </div>
      )}

      <form onSubmit={handleAuthSubmit} className="space-y-[15px] text-left">
        {isSignUp ? (
          /* ========================================================================= */
          /* ======================== SIGN UP FIELDS ================================= */
          /* ========================================================================= */
          <>
            <Input
              id="name"
              type="text"
              placeholder={activeRole === 'headmaster' ? 'Enter your school name' : 'Enter your full name'}
              required
              icon={icons.user}
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
            />

            <Input
              id="email"
              type="email"
              placeholder={
                activeRole === 'headmaster' 
                  ? 'Enter your school email' 
                  : activeRole === 'teacher' 
                    ? 'Enter your teacher email' 
                    : 'Enter your student email'
              }
              required
              icon={icons.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />

            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              required
              icon={icons.lock}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
            />

            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              required
              icon={icons.lock}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={errors.confirmPassword}
            />
          </>
        ) : (
          /* ========================================================================= */
          /* ======================== SIGN IN FIELDS ================================= */
          /* ========================================================================= */
          <>
            {activeRole === 'headmaster' && (
              <>
                <Input
                  id="npsn"
                  type="text"
                  placeholder="Enter school NPSN (8 digits)"
                  required
                  icon={icons.schoolCode}
                  value={npsn}
                  onChange={(e) => setNpsn(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  error={errors.npsn}
                />
                <Input
                  id="loginPassword"
                  type="password"
                  placeholder="Enter your password"
                  required
                  icon={icons.lock}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  error={errors.loginPassword}
                />
              </>
            )}

            {activeRole === 'teacher' && (
              <div className="space-y-4">
                <div className="flex bg-slate-50 border border-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setTeacherMethod('google')}
                    className={`flex-1 text-center py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors ${
                      teacherMethod === 'google'
                        ? 'bg-violet-100 text-violet-700'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Gmail (OAuth)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeacherMethod('school_code')}
                    className={`flex-1 text-center py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors ${
                      teacherMethod === 'school_code'
                        ? 'bg-violet-100 text-violet-700'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    School Code
                  </button>
                </div>

                {teacherMethod === 'google' ? (
                  <div className="py-2 space-y-4 text-center">
                    <p className="text-sm text-slate-400">
                      Gunakan akun Google yang terdaftar secara resmi di sistem sekolah Anda.
                    </p>
                    <Button
                      variant="outline"
                      className="w-full justify-center gap-2 border border-slate-200 py-3 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm text-slate-700 font-semibold text-sm md:text-base"
                      onClick={handleGoogleAuth}
                      isLoading={isLoading}
                    >
                      {icons.google}
                      Sign in with Gmail
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      id="schoolCode"
                      type="text"
                      placeholder="Enter school code"
                      required
                      icon={icons.schoolCode}
                      value={schoolCode}
                      onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                      error={errors.schoolCode}
                    />
                    <Input
                      id="username"
                      type="text"
                      placeholder="Enter username/email"
                      required
                      icon={icons.user}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      error={errors.username}
                    />
                    <Input
                      id="loginPassword"
                      type="password"
                      placeholder="Enter your password"
                      required
                      icon={icons.lock}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      error={errors.loginPassword}
                    />
                  </>
                )}
              </div>
            )}

            {activeRole === 'student' && (
              <>
                <Input
                  id="schoolCode"
                  type="text"
                  placeholder="Enter school code"
                  required
                  icon={icons.schoolCode}
                  value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                  error={errors.schoolCode}
                />
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter NISN / username"
                  required
                  icon={icons.user}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  error={errors.username}
                />
                <Input
                  id="loginPassword"
                  type="password"
                  placeholder="Enter your password"
                  required
                  icon={icons.lock}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  error={errors.loginPassword}
                />
              </>
            )}
          </>
        )}

        {/* Submit button: purple pill, "Continue ->" */}
        {!(activeRole === 'teacher' && !isSignUp && teacherMethod === 'google') && (
          <Button
            type="submit"
            className="w-full py-3 md:py-3.5 rounded-2xl justify-center font-bold text-sm md:text-base bg-[#7047EB] hover:bg-[#5E3BD2] active:scale-95 transition-transform mt-5 shadow-lg shadow-[#7047EB]/20 text-white select-none"
            isLoading={isLoading}
          >
            <span className="flex items-center gap-1">
              Continue
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 mt-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </span>
          </Button>
        )}

        {/* Social login buttons: or sign up / sign in with */}
        {!(activeRole === 'teacher' && !isSignUp && teacherMethod === 'google') && (
          <div className="pt-4 space-y-4">
            <div className="flex items-center justify-center gap-3">
              <span className="h-px bg-slate-100 flex-1"></span>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider select-none">
                or {isSignUp ? 'sign up' : 'sign in'} with
              </span>
              <span className="h-px bg-slate-100 flex-1"></span>
            </div>

            <div className="flex justify-center gap-4">
              <Button
                variant="social"
                size="circle"
                onClick={handleGoogleAuth}
                isLoading={isLoading}
                ariaLabel={`Masuk dengan Google`}
                className="w-12 h-12 flex items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 shadow-sm"
              >
                {icons.google}
              </Button>
              <Button
                variant="social"
                size="circle"
                onClick={() => showToast('Facebook Sign-In is under construction.', 'info')}
                ariaLabel={`Masuk dengan Facebook`}
                className="w-12 h-12 flex items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 shadow-sm"
              >
                {icons.facebook}
              </Button>
              <Button
                variant="social"
                size="circle"
                onClick={() => showToast('Apple Sign-In is under construction.', 'info')}
                ariaLabel={`Masuk dengan Apple`}
                className="w-12 h-12 flex items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 shadow-sm"
              >
                {icons.apple}
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default LoginForm;
