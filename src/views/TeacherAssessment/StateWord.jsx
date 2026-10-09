import React from 'react';

import { STATE_TONE, stateOf } from './teacherAssessment';

/*
  An assessment's state as a small pill (owner, 2026-10-08): Draf, Aktif, Selesai
  or Dibatalkan on a pale fill of its colour, never broken over two lines. It sits
  right after the title, not at the far end of the row.

  Shown in capitals like the academic-year badge on /headmaster/classes (owner,
  later the same day: a state should stand out). The capitals come from CSS, so
  the dictionary word stays "Aktif" and a screen reader says the word, not letters.
*/
export const StateWord = ({ assessment, t, className = '' }) => {
  const state = stateOf(assessment);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase leading-4 whitespace-nowrap ${STATE_TONE[state]} ${className}`}>
      {t(`tasm.state.${state}`)}
    </span>
  );
};

export default StateWord;
