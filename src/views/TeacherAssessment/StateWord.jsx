import React from 'react';

import { STATE_TONE, stateOf } from './teacherAssessment';

/*
  An assessment's state as a small pill (owner, 2026-10-08): Draf, Aktif, Selesai
  or Dibatalkan on a pale fill of its colour, in sentence case, never broken over
  two lines. It sits right after the title, not at the far end of the row.
*/
export const StateWord = ({ assessment, t, className = '' }) => {
  const state = stateOf(assessment);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold leading-4 whitespace-nowrap ${STATE_TONE[state]} ${className}`}>
      {t(`tasm.state.${state}`)}
    </span>
  );
};

export default StateWord;
