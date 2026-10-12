import React, { Fragment } from 'react';
import { ChevronRight } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { LIST_BADGE_TONE, groupAssessments, typeModeText, whenLine } from './teacherAssessment';

/*
  A class subject's assessments, grouped by where they stand (owner, 2026-10-11:
  a pill and two grey lines per row read as a pile). A small heading per group -
  open now, coming up, drafts, ended, cancelled - says the state, so a row is two
  lines: the title, then "Kuis daring / ditutup 19 Des 23:59" with only the
  time that matters now. The whole window stays on the assessment's own page.

  Used by the teacher's "Penilaian" tab and, `compact`, by the readers'
  AssessmentReader inside its dialog.

  @param assessments  the list as GET /assessments/class-subjects/:id answers it
  @param zone         the school's zone
  @param onOpen       (assessment) => void
  @param compact      smaller type and no card shadow, for a dialog
*/
export const AssessmentList = ({ assessments, zone, onOpen, compact = false }) => {
  const { t, lang } = useT();
  const groups = groupAssessments(assessments);

  const box = compact ? 'border border-slate-100 rounded-xl' : 'bg-white border border-slate-100 rounded-2xl shadow-sm';
  const rowPad = compact ? 'px-3 py-2.5' : 'px-4 sm:px-5 py-3.5';
  const corner = compact ? 'first:rounded-t-xl last:rounded-b-xl' : 'first:rounded-t-2xl last:rounded-b-2xl';

  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      {groups.map((group) => (
        <section key={group.key} className="space-y-2" aria-labelledby={`asm-group-${group.key}`}>
          <h3 id={`asm-group-${group.key}`} className={`flex items-baseline gap-2 font-extrabold text-slate-900 ${compact ? 'text-xs' : 'text-sm'}`}>
            {t(`tasm.group.${group.key}`)}
            <span className="text-xs font-semibold text-slate-500 tabular-nums">{group.rows.length}</span>
          </h3>
          <ul className={`${box} divide-y divide-slate-100`}>
            {group.rows.map((assessment) => {
              const when = whenLine(assessment, zone, lang);
              const facts = [
                typeModeText(t, assessment),
                t(when.key, when.vars),
              ];
              return (
                <li key={assessment.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(assessment)}
                    className={`w-full text-left ${rowPad} flex items-center gap-3 hover:bg-slate-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${corner}`}
                  >
                    <span className="min-w-0 flex-1 space-y-0.5">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={`min-w-0 font-extrabold text-slate-900 break-words ${compact ? 'text-xs' : 'text-sm'}`}>{assessment.title}</span>
                        {/* Capitals from CSS, as StateWord's: the word itself stays "Belum dibuka". */}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase leading-4 whitespace-nowrap ${LIST_BADGE_TONE[group.key]}`}>
                          {t(`tasm.badge.${group.key}`)}
                        </span>
                      </span>
                      {/* FactLine's look - grey, light slashes - in spans: a button takes no <p>. */}
                      <span className="block text-xs font-semibold text-slate-500">
                        {facts.filter(Boolean).map((part, i) => (
                          <Fragment key={part}>
                            {/* Spaces round the slash: the line may break there, never inside a part. */}
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
                      </span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default AssessmentList;
