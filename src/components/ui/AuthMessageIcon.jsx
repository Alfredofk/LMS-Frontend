import React from 'react';

/*
  The icon of a message box on the sign-in card: white in a filled circle of the
  box's tone. The boxes lost their thick left bar (owner, 2026-10-29); the
  filled circle is what still marks them at a glance.
*/
const TONES = {
  success: { circle: 'bg-emerald-600', path: 'M4.5 12.75l6 6 9-13.5' },
  error: { circle: 'bg-rose-600', path: 'M12 6v7.5m0 4.5h.008v.008H12V18z' },
  warning: { circle: 'bg-amber-500', path: 'M12 6v7.5m0 4.5h.008v.008H12V18z' },
};

export const AuthMessageIcon = ({ tone = 'error' }) => {
  const { circle, path } = TONES[tone] ?? TONES.error;
  return (
    <span className={`w-5 h-5 rounded-full ${circle} text-white flex items-center justify-center shrink-0`} aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3">
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
      </svg>
    </span>
  );
};

export default AuthMessageIcon;
