import { useSyncExternalStore } from 'react';

/*
  Where the navbar's back arrow leads from a student's assessment (owner,
  2026-10-12): the outline sits under its subject's "Penilaian" tab, an attempt
  under its outline. The address names the assessment only, so the outline and
  the attempt page note its class subject here once read; until then (an address
  opened cold) the arrow leads to /assessment.
*/

const subjectOf = new Map();
const listeners = new Set();
let version = 0;

/** The outline or the attempt page has read which class subject an assessment sits on. */
export function noteAssessmentSubject(assessmentId, classSubjectId) {
  if (!assessmentId || !classSubjectId || subjectOf.get(assessmentId) === classSubjectId) return;
  subjectOf.set(assessmentId, classSubjectId);
  version += 1;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * The back arrow for a path under /assessment/:id, `{ to, labelKey }`, or null
 * for any other path.
 */
export function assessmentBackOf(pathname) {
  const match = /^\/assessment\/([^/]+)(\/percobaan\/[^/]+)?$/.exec(pathname);
  if (!match) return null;
  if (match[2]) return { to: `/assessment/${match[1]}`, labelKey: 'sasm.backToOutline' };
  const classSubjectId = subjectOf.get(match[1]);
  return classSubjectId
    ? { to: `/classroom/${classSubjectId}?tab=penilaian`, labelKey: 'smenu.backToSubject' }
    : { to: '/assessment', labelKey: 'smenu.backToList' };
}

/** assessmentBackOf, re-rendered when a class subject is noted. */
export function useAssessmentBack(pathname) {
  useSyncExternalStore(subscribe, () => version);
  return assessmentBackOf(pathname);
}
