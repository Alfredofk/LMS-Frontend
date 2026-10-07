import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ChevronDown, Circle, CircleDashed } from 'lucide-react';

import { useT } from '../../../i18n/LanguageContext';
import { setupSteps } from '../setup';

/*
  "Getting the school ready" — on the Principal's dashboard (owner, 2026-09-26).

  The steps a school takes before anybody is taught are spread over four pages
  (Classes, Join requests, Subjects, and the School Code on My Profile), and the
  order is nowhere written: a class needs a homeroom teacher, a subject needs a
  semester and a class. This card lists them in that order, ticks what the
  backend already shows done, highlights the next one with a button to where it
  is done, and says which must wait for an earlier step. Which is which is
  `setupSteps` (setup.js, tested).

  Its data comes from the dashboard (`data`: years, classes, teachers,
  assignments — the same reads its number cards use, so nothing is asked twice).
  Each may be null when its read failed: those steps say "could not be read"
  instead of the card coming down. All four null — an old backend — hides it.
  Once every step is done it folds to one line, and can be opened again.
*/

const ACTION = {
  YEAR: '/headmaster/classes',
  SEMESTER: '/headmaster/classes',
  TEACHERS: '/join-requests',
  CLASSES: '/headmaster/classes',
  SUBJECTS: '/headmaster/subjects',
  STUDENTS: '/profile',
};

/* A Vice Principal cannot release a teacher's join request, and the School Code
   is handed out by the Principal: those two steps are shown, without a button. */
const VICE_ACTION = { ...ACTION, TEACHERS: null, STUDENTS: null };

export const SetupChecklist = ({ data, desk = 'principal' }) => {
  const actions = desk === 'vice' ? VICE_ACTION : ACTION;
  const { t } = useT();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(null); // null = decided by completeness

  if (!data) {
    return <div className="h-20 bg-white border border-slate-100 rounded-2xl animate-pulse" aria-label={t('common.loading')} />;
  }
  if (Object.values(data).every((value) => value === null)) return null;

  const today = new Date().toISOString().slice(0, 10);
  const { year, steps, done, total, next } = setupSteps({ ...data, today });
  const complete = total > 0 && done === total;
  const open = isOpen ?? !complete;

  return (
    <section
      aria-labelledby="setup-title"
      className={`bg-white border rounded-2xl shadow-sm ${complete ? 'border-emerald-200' : 'border-brand/30'}`}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!open)}
        aria-expanded={open}
        aria-controls="setup-steps"
        className="w-full flex items-center justify-between gap-3 p-5 text-left cursor-pointer rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className="min-w-0">
          <span id="setup-title" className="flex items-center gap-1.5 text-base font-extrabold text-slate-900">
            {t('setup.title')}
            {complete && <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />}
          </span>
          <span className="block text-xs font-semibold text-slate-500 mt-0.5">
            {complete
              ? t('setup.complete', { label: year?.label ?? '' })
              : t('setup.progress', { done, total })}
          </span>
        </span>
        <span className="flex items-center gap-3 shrink-0">
          {!complete && (
            <span className="hidden sm:block w-28 h-2 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
              <span className="block h-full bg-brand rounded-full" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </span>
      </button>

      {open && (
        <ol id="setup-steps" className="px-5 pb-5 space-y-2">
          {steps.map((step, index) => {
            const isNext = step.id === next;
            const vars = { n: step.count ?? 0, label: year?.label ?? '' };
            return (
              <li
                key={step.id}
                className={`rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                  isNext ? 'border-brand/40 bg-brand-tint/40' : 'border-slate-100'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  {step.state === 'done' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                  ) : step.state === 'todo' ? (
                    <Circle className={`w-5 h-5 shrink-0 mt-0.5 ${isNext ? 'text-brand' : 'text-slate-400'}`} aria-hidden="true" />
                  ) : (
                    <CircleDashed className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  <div className="min-w-0">
                    <p className={`text-sm font-bold break-words ${step.state === 'done' ? 'text-slate-700' : 'text-slate-900'}`}>
                      <span className="sr-only">{t(`setup.state.${step.state}`)}: </span>
                      {index + 1}. {t(step.state === 'done' ? `setup.${step.id}.done` : `setup.${step.id}.todo`, vars)}
                    </p>
                    {step.state !== 'done' && (
                      <p className="text-xs font-semibold text-slate-500 leading-relaxed mt-0.5">
                        {step.state === 'blocked'
                          ? t('setup.blocked')
                          : step.state === 'unknown'
                            ? t('setup.unknown')
                            : t(`setup.${step.id}.hint`)}
                      </p>
                    )}
                  </div>
                </div>
                {step.state === 'todo' && actions[step.id] && (
                  <button
                    type="button"
                    onClick={() => navigate(actions[step.id])}
                    className={`self-start sm:self-auto shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                      isNext
                        ? 'bg-brand hover:bg-brand-deep text-white'
                        : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {t(`setup.${step.id}.action`)}
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};

export default SetupChecklist;
