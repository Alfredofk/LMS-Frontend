import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';

import { useT } from '../../../i18n/LanguageContext';
import Button from '../../../components/ui/Button';
import { setupSteps } from '../setup';
import { Bone, HomeCard } from './HomeCard';

/*
  "Getting the school ready" - on the Principal's dashboard (owner, 2026-09-26).

  The steps a school takes before anybody is taught are spread over four pages
  (Classes, Join requests, Subjects, and the School Code on My Profile), and the
  order is nowhere written: a class needs a homeroom teacher, a subject needs a
  semester and a class. This card lists them in that order, ticks what the
  backend already shows done, highlights the next one with a button to where it
  is done, and says which must wait for an earlier step. Which is which is
  `setupSteps` (setup.js, tested).

  Its data comes from the dashboard (`data`: years, classes, teachers,
  assignments - the same reads its number cards use, so nothing is asked twice).
  Each may be null when its read failed: those steps say "could not be read"
  instead of the card coming down. All four null - an old backend - hides it.

  The look since 2026-10-27 (the approved Principal mockup; the skill
  `.claude/skills/eduforid-design`): "5 dari 6" and a bar of six parts - green
  done, purple the next, grey not yet - then the steps, the next one tinted with
  the one main button. Done, it is one green line ("Sekolah siap dipakai"), and the
  steps can be opened again.
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

export const SetupChecklist = ({ data, desk = 'principal', className = '' }) => {
  const actions = desk === 'vice' ? VICE_ACTION : ACTION;
  const { t } = useT();
  const navigate = useNavigate();
  const [showSteps, setShowSteps] = useState(false);

  const card = (body) => (
    <HomeCard id="setup-title" title={t('setup.title')} className={className}>
      {body}
    </HomeCard>
  );

  if (!data) {
    return card(
      <div aria-busy="true" aria-label={t('common.loading')}>
        <Bone className="h-6 w-1/3" />
        <Bone className="h-2 w-full mt-3" />
        {[0, 1, 2].map((n) => (
          <Bone key={n} className="h-8 w-full mt-2.5" />
        ))}
      </div>
    );
  }
  if (Object.values(data).every((value) => value === null)) return null;

  const today = new Date().toISOString().slice(0, 10);
  const { year, steps, done, total, next } = setupSteps({ ...data, today });
  const complete = total > 0 && done === total;
  const label = year?.label ?? '';

  const list = (
    <ol className="mt-2.5 space-y-0.5">
      {steps.map((step) => {
        const isNext = step.id === next;
        const vars = { n: step.count ?? 0, label };
        return (
          <li key={step.id} className={`flex items-start gap-3 rounded-[10px] px-1.5 py-2 ${isNext ? 'bg-brand-tint' : ''}`}>
            <span
              className={`mt-px grid place-items-center w-[22px] h-[22px] rounded-full border-2 shrink-0 ${
                step.state === 'done' ? 'bg-emerald-600 border-emerald-600 text-white' : isNext ? 'border-brand border-dashed' : 'border-slate-200'
              }`}
              aria-hidden="true"
            >
              {step.state === 'done' && <Check className="w-3 h-3" strokeWidth={3} />}
            </span>
            <span className="flex-1 min-w-0">
              <span className={`block text-[13px] break-words ${step.state === 'done' ? 'font-semibold text-slate-600' : 'font-bold text-slate-900'}`}>
                <span className="sr-only">{t(`setup.state.${step.state}`)}: </span>
                {t(step.state === 'done' ? `setup.${step.id}.done` : `setup.${step.id}.todo`, vars)}
              </span>
              {step.state !== 'done' && (
                <span className="block text-xs text-slate-500">
                  {step.state === 'blocked' ? t('setup.blocked') : step.state === 'unknown' ? t('setup.unknown') : t(`setup.${step.id}.hint`)}
                </span>
              )}
              {step.state === 'todo' && actions[step.id] && (
                <span className="block mt-2.5">
                  <Button size="sm" variant={isNext ? 'primary' : 'outline'} onClick={() => navigate(actions[step.id])}>
                    <span className="inline-flex items-center gap-1.5">
                      {t(`setup.${step.id}.action`)}
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  </Button>
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );

  return card(
    <>
      <p className="flex flex-wrap items-baseline gap-x-2 mb-3">
        <b className="text-2xl font-extrabold text-slate-900 tracking-tight leading-none tabular-nums">{t('setup.count', { done, total })}</b>
        <span className="text-xs text-slate-500">{t('setup.countSub', { label })}</span>
      </p>
      <div className="flex gap-1.5" aria-hidden="true">
        {steps.map((step) => (
          <i
            key={step.id}
            className={`flex-1 h-2 rounded-full transition-colors duration-300 ${
              step.state === 'done' ? 'bg-emerald-600' : step.id === next ? 'bg-brand' : 'bg-slate-100'
            }`}
          />
        ))}
      </div>
      {complete ? (
        <>
          <div className="mt-3.5 flex items-center gap-3 rounded-xl bg-emerald-50 px-3.5 py-3 text-sm font-bold text-emerald-700">
            <span className="grid place-items-center w-7 h-7 rounded-full bg-emerald-600 text-white shrink-0">
              <Check className="w-4 h-4" strokeWidth={3} aria-hidden="true" />
            </span>
            {t('setup.ready', { label })}
          </div>
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => setShowSteps((value) => !value)}
              aria-expanded={showSteps}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 underline underline-offset-2 cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {t(showSteps ? 'setup.hide' : 'setup.show')}
            </button>
          </div>
          {showSteps && list}
        </>
      ) : (
        list
      )}
    </>
  );
};

export default SetupChecklist;
