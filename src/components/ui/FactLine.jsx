import React, { Fragment } from 'react';

/*
  A subject and the facts that place it, in one grey line (owner, 2026-10-08):
  "MTK - Matematika / XI IPS / Semester 1": the code and name of the subject joined
  by a dash, the facts after it set apart by slashes a lighter grey. It replaced
  " - " between every part, which read as one run of dashes.

  @param code   the subject's code, e.g. "MTK"
  @param name   its name
  @param facts  further facts, already translated; empty ones are left out
  @param size   'sm' under a page title, 'xs' under a dialog title
*/
export const FactLine = ({ code, name, facts = [], size = 'sm', className = '' }) => {
  const text = size === 'xs' ? 'text-xs font-semibold' : 'text-sm font-medium';
  const parts = [[code, name].filter(Boolean).join(' - '), ...facts].filter(Boolean);
  return (
    <p className={`${text} text-slate-500 ${className}`}>
      {parts.map((part, i) => (
        <Fragment key={part}>
          {i > 0 && (
            <>
              {' '}
              <span className="mx-1 text-slate-300" aria-hidden="true">
                /
              </span>{' '}
            </>
          )}
          <span className="whitespace-nowrap">{part}</span>
        </Fragment>
      ))}
    </p>
  );
};

export default FactLine;
