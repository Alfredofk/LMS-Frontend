import React, { useEffect, useState } from 'react';

/*
  A subject's materials as one bar in three parts - completed, opened, not opened
  (owner, 2026-10-27, the approved "Kemajuan mapel"). Out of SubjectProgressCard
  since 2026-10-28, when the "Kelas Saya" cards took it too (the reviewed mockup).

  `large` is the semester's bar: it stays purple at 100%, as its legend says. A
  subject's bar turns green when complete, beside its "Tuntas".
*/

const EASE = 'transition-[width] duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none';

export const ThreePartBar = ({ done, opened, total, large = false, label, className = 'mt-2' }) => {
  /* One frame at zero, then the real widths, so the bar fills as the card appears. */
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const part = (n) => (shown && total > 0 ? `${(n / total) * 100}%` : '0%');
  return (
    <div role="img" aria-label={label} className={`flex overflow-hidden rounded-full ${large ? 'h-2.5 bg-slate-200' : `h-2 bg-slate-100 ${className}`}`}>
      <i className={`h-full ${EASE} ${!large && total > 0 && done === total ? 'bg-emerald-600' : 'bg-brand'}`} style={{ width: part(done) }} />
      <i className={`h-full bg-brand/35 ${EASE}`} style={{ width: part(opened - done) }} />
    </div>
  );
};

export default ThreePartBar;
