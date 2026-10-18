import { useEffect, useState } from 'react';

import { gradingService } from '../../services/gradingService';

/*
  Whether a class subject's slot is finalised (backend eadf680, ticket 04), for the
  teacher's assessment pages, which lock while it is (owner, 2026-10-18): the grade
  read's `finalised`, kept a minute per class subject so moving between an
  assessment, its results and an attempt reads it once. Finalising or undoing it
  forgets it (forgetSlotFinalised).

  Answers undefined while reading, then `{ at, by } | null`. A read that fails
  answers null: the page stays as it was, and the server's 409 still says why.
*/

const KEPT_MS = 60_000;
const kept = new Map();

const fresh = (id) => {
  const found = kept.get(id);
  return found && Date.now() - found.at < KEPT_MS ? found.value : undefined;
};

/** Drop what is kept for a class subject, after finalising or undoing it. */
export const forgetSlotFinalised = (classSubjectId) => kept.delete(classSubjectId);

export function useSlotFinalised(classSubjectId) {
  const [read, setRead] = useState(() => ({ id: classSubjectId, value: fresh(classSubjectId) }));
  if (read.id !== classSubjectId) setRead({ id: classSubjectId, value: fresh(classSubjectId) });

  useEffect(() => {
    if (!classSubjectId || fresh(classSubjectId) !== undefined) return undefined;
    let cancelled = false;
    gradingService
      .slotGrades(classSubjectId)
      .then((grades) => {
        const value = grades?.finalised ?? null;
        kept.set(classSubjectId, { at: Date.now(), value });
        if (!cancelled) setRead({ id: classSubjectId, value });
      })
      .catch(() => !cancelled && setRead({ id: classSubjectId, value: null }));
    return () => {
      cancelled = true;
    };
  }, [classSubjectId]);

  return read.id === classSubjectId ? read.value : undefined;
}
