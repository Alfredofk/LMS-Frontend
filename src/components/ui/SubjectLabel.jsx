import React from 'react';

/*
  A subject as "[BIO] Biologi": the code in a small badge before the name,
  instead of "BIO · Biologi" (owner, 2026-10-03: polish the dot-separated
  lines). The badge keeps the code readable at a glance in a long list.
*/
export const SubjectLabel = ({ code, name }) => (
  <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
    {code && (
      <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-extrabold tabular-nums tracking-wide">
        {code}
      </span>
    )}
    <span>{name}</span>
  </span>
);

export default SubjectLabel;
